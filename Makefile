# Twisty: data pipeline, web app, Android APK and iOS app.
# Run `make` to list the targets.

# The first Python that meets pipeline/pyproject.toml (>=3.12): the system python3 on macOS is older.
PYTHON ?= $(shell for p in python3.13 python3.12 python3.14 python3; do \
	command -v $$p >/dev/null && $$p -c 'import sys; sys.exit(sys.version_info < (3, 12))' && { command -v $$p; break; }; done)
ADB ?= adb

APP_ID := com.sanchezpaco.twisty
SPAIN_URL := https://download.geofabrik.de/europe/spain-latest.osm.pbf
SPAIN_PBF := data/raw/spain-latest.osm.pbf
# Geofabrik files the Canary Islands under Africa: the pipeline merges them with Spain.
CANARIES_URL := https://download.geofabrik.de/africa/canary-islands-latest.osm.pbf
CANARIES_PBF := data/raw/canary-islands-latest.osm.pbf
VENV := pipeline/.venv
DATA := app/public/data
GRAPH := $(DATA)/graph.bin
OVERLAY := $(DATA)/overlay
APK_BUILT := app/android/app/build/outputs/apk/debug/app-debug.apk
APK := dist/twisty-debug.apk
BUNDLE := app/android/app/build/outputs/bundle/release/app-release.aab
# The upload key and the Play service account live outside the repository, named in this git-ignored file.
LOCAL_PROPERTIES := app/android/local.properties
# The simulator `make ios-sim` boots, by name (`xcrun simctl list devices available`).
IOS_SIM ?= Twisty 13 mini
IOS_DERIVED := app/ios/DerivedData
IOS_SIM_APP := $(IOS_DERIVED)/Build/Products/Debug-iphonesimulator/App.app
PLAY_JSON_KEY = $(shell sed -n 's/^twisty.play.serviceAccountJson=//p' $(LOCAL_PROPERTIES) 2>/dev/null)

.DEFAULT_GOAL := help
.PHONY: help setup data overlay candidates data-release overlay-parity test bench bench-baseline bench-via bench-eval dev web android apk bundle publish-internal install run logs open-android ios ios-sim open-ios clean

help: ## List the available targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

setup: $(VENV) app/node_modules ## Install pipeline and app dependencies

$(VENV): pipeline/pyproject.toml
	@test -n "$(PYTHON)" || { echo "Python 3.12 or newer not found: install it (brew install python@3.13) or pass PYTHON=/path/to/python"; exit 1; }
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/pip install -q -e 'pipeline[dev]'
	@touch $(VENV)

app/node_modules: app/package.json app/package-lock.json
	cd app && npm ci
	@touch app/node_modules

data: $(GRAPH) overlay candidates ## Download Spain and the Canary Islands from OpenStreetMap and build the app data (needs osmium-tool)

$(SPAIN_PBF):
	mkdir -p $(dir $@)
	curl -L --fail -o $@ $(SPAIN_URL)

$(CANARIES_PBF):
	mkdir -p $(dir $@)
	curl -L --fail -o $@ $(CANARIES_URL)

$(GRAPH): $(SPAIN_PBF) $(CANARIES_PBF) $(VENV) $(wildcard pipeline/twisty_pipeline/*.py)
	cd pipeline && .venv/bin/python -m twisty_pipeline build --input ../$(SPAIN_PBF) ../$(CANARIES_PBF)

overlay: app/node_modules ## Cut the twisty overlay tiles from the pipeline's twisties (Node 22.18 or newer)
	cd app && node scripts/overlay-tiles.ts

candidates: app/node_modules $(GRAPH) ## Find the twisty roads of the graph once, for the planner (public/data/candidates.bin)
	cd app && npx vite build --config bench/vite.config.ts --ssr scripts/candidates.ts --outDir scripts/.build
	cd app && node scripts/.build/candidates.js

# Without the file, or with one of another graph, every phone finds the candidates itself on its first plan.
check-candidates: app/node_modules check-data
	cd app && npx vite build --config bench/vite.config.ts --ssr scripts/candidates.ts --outDir scripts/.build
	cd app && node scripts/.build/candidates.js --check

overlay-parity: app/node_modules check-data ## Check the overlay tiles draw the same picture as the GeoJSON they come from (needs Chrome)
	cd app && node scripts/overlay-parity.ts

# The ODbL share-alike copy of the road data the APK carries (tracks.bin is dropped from the build while tracks are not offered).
# The name is meta.json's "version" (the data format number) and "generatedAt" (UTC), so two builds of one format differ.
data-release: check-candidates ## Pack the shipped road data into dist/twisty-data-v<version>-<built>.zip, for the ODbL download
	@test -f $(DATA)/LICENSE.txt || { echo "Missing $(DATA)/LICENSE.txt, the ODbL notice: rebuild the data with 'make data'."; exit 1; }
	@test -f $(DATA)/meta.json || { echo "Missing $(DATA)/meta.json: rebuild the data with 'make data'."; exit 1; }
	$(eval DATA_VERSION := $(shell sed -n 's/.*"version": *\([0-9][0-9]*\).*/\1/p' $(DATA)/meta.json))
	$(eval DATA_BUILT := $(shell sed -n 's/.*"generatedAt": *"\([0-9]\{4\}\)-\([0-9]\{2\}\)-\([0-9]\{2\}\)T\([0-9]\{2\}\):\([0-9]\{2\}\).*/\1\2\3-\4\5/p' $(DATA)/meta.json))
	$(eval DATA_ZIP := dist/twisty-data-v$(DATA_VERSION)-$(DATA_BUILT).zip)
	@test -n "$(DATA_VERSION)" -a -n "$(DATA_BUILT)" || { echo "No version or generatedAt in $(DATA)/meta.json."; exit 1; }
	mkdir -p dist
	rm -f $(DATA_ZIP)
	cd $(DATA) && zip -qr -X $(CURDIR)/$(DATA_ZIP) graph.bin candidates.bin places.json overlay meta.json LICENSE.txt
	@echo "Data ready: $(DATA_ZIP) ($$(du -h $(DATA_ZIP) | cut -f1))"

test: setup ## Run pipeline tests, app tests and type checks
	cd pipeline && .venv/bin/pytest -q
	cd app && npm test
	cd app && npm run check

bench: app/node_modules check-data ## Plan the bench trips and report route quality (docs/route-quality-bench.md)
	cd app && npx vite build --config bench/vite.config.ts --ssr bench/run.ts --outDir bench/.build
	cd app && node bench/.build/run.js run $(BENCH_ARGS)

bench-baseline: app/node_modules check-data ## Re-record bench/baseline.jsonl after a change meant to alter routes
	cd app && npx vite build --config bench/vite.config.ts --ssr bench/run.ts --outDir bench/.build
	cd app && node bench/.build/run.js baseline

bench-via: app/node_modules check-data ## Plan the trips with stops and report them (bench/via-trips.json), report only
	cd app && npx vite build --config bench/vite.config.ts --ssr bench/run.ts --outDir bench/.build
	cd app && node bench/.build/run.js via

bench-eval: app/node_modules ## Write the blind evaluation dossier of the frozen lists: EVAL_OUT=<dir> [EVAL_ARGS=--added <results.jsonl>], data from TWISTY_DATA
	cd app && npx vite build --config bench/vite.config.ts --ssr bench/run.ts --outDir bench/.build
	cd app && node bench/.build/run.js eval --out $(EVAL_OUT) $(EVAL_ARGS)

dev: app/node_modules check-data ## Start the dev server, reachable from phones on the same network
	cd app && npm run dev -- --host

web: app/node_modules check-data ## Build the web app into app/dist
	cd app && npm run build

android: web ## Copy the web build and data into the Android project
	cd app && npx cap sync android

# Gradle updates the previous app-debug.apk in place and the entries it replaces stay in the file as dead bytes (a
# 111.8 MB APK came out at 193.3 MB), and `adb install` copies all of it: so the old file goes first.
apk: android ## Build a debug APK into dist/ (needs JDK 21 and the Android SDK)
	rm -f $(APK_BUILT)
	cd app/android && ./gradlew assembleDebug
	mkdir -p dist
	cp $(APK_BUILT) $(APK)
	@echo "APK ready: $(APK) ($$(du -h $(APK) | cut -f1))"

bundle: check-candidates android ## Build the signed release bundle (AAB) for Google Play into dist/ (needs the upload key)
	@grep -q '^twisty.keystore.path=' $(LOCAL_PROPERTIES) 2>/dev/null || { echo "Name the upload key in $(LOCAL_PROPERTIES): twisty.keystore.path, storePassword, keyAlias, keyPassword"; exit 1; }
	@test -f $(DATA)/LICENSE.txt || { echo "Missing $(DATA)/LICENSE.txt, the ODbL notice: rebuild the data with 'make data'."; exit 1; }
	cd app/android && ./gradlew bundleRelease
	mkdir -p dist
	cp $(BUNDLE) dist/twisty-release.aab
	@echo "Bundle ready: dist/twisty-release.aab ($$(du -h dist/twisty-release.aab | cut -f1))"

publish-internal: bundle ## Upload the bundle to the Play internal testing track (fastlane)
	@test -n "$(PLAY_JSON_KEY)" || { echo "Set twisty.play.serviceAccountJson=/path/to/key.json in $(LOCAL_PROPERTIES)"; exit 1; }
	fastlane supply --aab dist/twisty-release.aab --track internal --json_key "$(PLAY_JSON_KEY)" \
		--package_name $(APP_ID) --skip_upload_metadata --skip_upload_images --skip_upload_screenshots

install: apk ## Build and install the APK on the connected phone (adb)
	$(ADB) install -r $(APK)

run: install ## Build, install and launch the app on the connected phone
	$(ADB) shell monkey -p $(APP_ID) -c android.intent.category.LAUNCHER 1 >/dev/null

logs: ## Follow the app's WebView console and Capacitor logs
	$(ADB) logcat -v brief Capacitor:V Capacitor/Console:V chromium:V '*:S'

open-android: android ## Open the Android project in Android Studio
	cd app && npx cap open android

ios: web ## Copy the web build and data into the iOS project
	cd app && npx cap sync ios

ios-sim: ios ## Build the iOS app and launch it on a simulator (IOS_SIM, default "Twisty 13 mini": xcrun simctl create "Twisty 13 mini" "iPhone 13 mini"; needs Xcode)
	xcodebuild -project app/ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator \
		-destination 'platform=iOS Simulator,name=$(IOS_SIM)' -derivedDataPath $(IOS_DERIVED) build -quiet
	xcrun simctl boot '$(IOS_SIM)' 2>/dev/null || true
	xcrun simctl install '$(IOS_SIM)' $(IOS_SIM_APP)
	xcrun simctl launch '$(IOS_SIM)' $(APP_ID)

open-ios: ios ## Open the iOS project in Xcode (where the signing team is chosen)
	cd app && npx cap open ios

clean: ## Remove build outputs (keeps downloaded and generated data)
	rm -rf app/dist dist app/android/app/build app/android/build $(IOS_DERIVED)

.PHONY: check-data check-candidates
check-data:
	@test -f $(GRAPH) || { echo "Missing $(GRAPH). Run 'make data', or copy app/public/data from a machine that has it."; exit 1; }
	@test -d $(OVERLAY) || { echo "Missing $(OVERLAY). Run 'make overlay' after 'make data', or copy app/public/data from a machine that has it."; exit 1; }
