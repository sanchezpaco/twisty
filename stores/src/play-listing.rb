# Uploads the Play store listing (texts, icon, feature graphic, phone screenshots) of every language under
# <metadata_path> in one edit, without a release: fastlane supply ties the listing to a track's release and fails when
# the app has none. Touches no track, setting or form.
#   ruby play-listing.rb validate|commit <package> <metadata_path> <json_key_path>
# With Homebrew's fastlane, on its gems: GEM_HOME=~/.local/share/fastlane/4.0.0
#   GEM_PATH=~/.local/share/fastlane/4.0.0:$(brew --prefix fastlane)/libexec /opt/homebrew/opt/ruby/bin/ruby ...
require 'fastlane'
require 'supply'

mode, package, metadata, json_key = ARGV
abort 'usage: play-listing.rb validate|commit <package> <metadata_path> <json_key_path>' unless %w[validate commit].include?(mode) && json_key

Supply.config = FastlaneCore::Configuration.create(Supply::Options.available_options, {
  package_name: package, metadata_path: metadata, json_key: json_key,
})
client = Supply::Client.make_from_config
client.begin_edit(package_name: package)

Dir.children(metadata).sort.each do |lang|
  dir = File.join(metadata, lang)
  text = ->(name) { File.read(File.join(dir, name)).strip }
  listing = { title: text['title.txt'], short_description: text['short_description.txt'], full_description: text['full_description.txt'] }
  client.update_listing_for_language(language: lang, video: nil, **listing)

  uploaded = []
  %w[icon featureGraphic].each do |type|
    path = File.join(dir, 'images', "#{type}.png")
    client.clear_screenshots(image_type: type, language: lang)
    client.upload_image(image_path: path, image_type: type, language: lang)
    uploaded << type
  end
  shots = Dir[File.join(dir, 'images', 'phoneScreenshots', '*.png')].sort_by { |f| File.basename(f, '.png').to_i }
  client.clear_screenshots(image_type: 'phoneScreenshots', language: lang)
  shots.each { |f| client.upload_image(image_path: f, image_type: 'phoneScreenshots', language: lang) }

  puts "#{lang}: title #{listing[:title].length} chars, short #{listing[:short_description].length}, " \
       "full #{listing[:full_description].length}; #{uploaded.join(', ')}; #{shots.length} phone screenshots"
end

if mode == 'commit'
  client.commit_current_edit!
  puts 'committed'
else
  client.validate_current_edit!
  client.abort_current_edit
  puts 'validated, edit discarded'
end
