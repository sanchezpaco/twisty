package com.sanchezpaco.twisty;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Lists the apps that open a GPX file and hands a ride's GPX to one of them. */
@CapacitorPlugin(name = "OpenIn")
public class OpenInPlugin extends Plugin {
    private static final String GPX_TYPE = "application/gpx+xml";
    private static final int ICON_PX = 96;
    /** Google Maps has its own row (it takes the ride as a URL), so it is not listed among the GPX apps. */
    private static final String MAPS_PACKAGE = "com.google.android.apps.maps";

    @PluginMethod
    public void listGpxApps(PluginCall call) {
        PackageManager packages = getContext().getPackageManager();
        Set<String> seen = new HashSet<>();
        JSArray apps = new JSArray();
        for (ResolveInfo info : queryGpxHandlers(packages)) {
            String packageName = info.activityInfo.packageName;
            if (packageName.equals(getContext().getPackageName()) || packageName.equals(MAPS_PACKAGE) || !seen.add(packageName)) continue;
            JSObject app = new JSObject();
            app.put("packageName", packageName);
            app.put("label", info.loadLabel(packages).toString());
            app.put("icon", iconDataUrl(info.loadIcon(packages)));
            apps.put(app);
        }
        JSObject result = new JSObject();
        result.put("apps", apps);
        call.resolve(result);
    }

    @PluginMethod
    public void openGpx(PluginCall call) {
        String uri = call.getString("uri");
        String packageName = call.getString("packageName");
        if (uri == null || packageName == null) {
            call.reject("uri and packageName are required");
            return;
        }
        try {
            File file = cacheFile(uri);
            Uri shared = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(shared, GPX_TYPE)
                .setPackage(packageName)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            // From the activity, so that Back in the other app comes back to Twisty.
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not open " + packageName + ": " + error.getMessage(), error);
        }
    }

    /** The file the web side wrote, and only if it lives in this app's cache: the plugin never shares anything else. */
    private File cacheFile(String uri) throws IOException {
        File file = new File(Uri.parse(uri).getPath()).getCanonicalFile();
        if (!file.getPath().startsWith(getContext().getCacheDir().getCanonicalPath() + File.separator)) {
            throw new IOException("not a cache file");
        }
        return file;
    }

    @SuppressWarnings("deprecation")
    private List<ResolveInfo> queryGpxHandlers(PackageManager packages) {
        // The type alone decides: the address only has to be well formed for the filters to be matched against it.
        Intent probe = new Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse("content://probe/probe.gpx"), GPX_TYPE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return packages.queryIntentActivities(probe, PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY));
        }
        return packages.queryIntentActivities(probe, PackageManager.MATCH_DEFAULT_ONLY);
    }

    private static String iconDataUrl(Drawable icon) {
        Bitmap bitmap = Bitmap.createBitmap(ICON_PX, ICON_PX, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        icon.setBounds(0, 0, ICON_PX, ICON_PX);
        icon.draw(canvas);
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, png);
        return "data:image/png;base64," + Base64.encodeToString(png.toByteArray(), Base64.NO_WRAP);
    }
}
