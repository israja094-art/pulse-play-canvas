package app.lovable.zabplay.mediadelete;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.IntentSender;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "MediaDelete")
public class MediaDeletePlugin extends Plugin {
    private static final int DELETE_REQUEST_CODE = 0xDEAD;
    private PluginCall pendingDeleteCall;

    @PluginMethod
    public void deleteMedia(PluginCall call) {
        JSArray paths = call.getArray("paths");
        if (paths == null || paths.length() == 0) {
            call.reject("No paths provided");
            return;
        }

        try {
            List<Uri> mediaUris = new ArrayList<>();
            for (int i = 0; i < paths.length(); i++) {
                String rawPath = paths.getString(i);
                Uri mediaUri = resolveMediaUri(rawPath);
                if (mediaUri != null) {
                    mediaUris.add(mediaUri);
                }
            }

            if (mediaUris.isEmpty()) {
                call.reject("No matching media found in gallery");
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                PendingIntent pendingIntent = MediaStore.createDeleteRequest(
                    getContext().getContentResolver(),
                    mediaUris
                );
                pendingDeleteCall = call;
                IntentSender sender = pendingIntent.getIntentSender();
                Activity activity = getActivity();
                if (activity == null) {
                    pendingDeleteCall = null;
                    call.reject("No activity available");
                    return;
                }
                activity.startIntentSenderForResult(sender, DELETE_REQUEST_CODE, null, 0, 0, 0);
                return;
            }

            ContentResolver resolver = getContext().getContentResolver();
            int deleted = 0;
            for (Uri uri : mediaUris) {
                deleted += resolver.delete(uri, null, null);
            }

            JSObject result = new JSObject();
            result.put("deleted", deleted > 0);
            result.put("count", deleted);
            call.resolve(result);
        } catch (Exception ex) {
            call.reject("delete-failed", ex);
        }
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode != DELETE_REQUEST_CODE) {
            return;
        }
        PluginCall targetCall = pendingDeleteCall;
        pendingDeleteCall = null;
        if (targetCall == null) {
            return;
        }
        boolean ok = resultCode == Activity.RESULT_OK;
        JSObject result = new JSObject();
        result.put("deleted", ok);
        result.put("count", ok ? 1 : 0);
        targetCall.resolve(result);
    }

    private Uri resolveMediaUri(String rawPath) {
        if (rawPath == null || rawPath.isEmpty()) return null;
        String normalized = rawPath
            .replace("file://", "")
            .replace("/sdcard/", "/storage/emulated/0/");

        Uri videoUri = queryUri(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, normalized);
        if (videoUri != null) return videoUri;
        Uri filesUri = queryUri(MediaStore.Files.getContentUri("external"), normalized);
        if (filesUri != null) return filesUri;
        return null;
    }

    private Uri queryUri(Uri collection, String absolutePath) {
        ContentResolver resolver = getContext().getContentResolver();
        String[] projection = new String[] { MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DATA };
        Cursor cursor = null;
        try {
            cursor = resolver.query(collection, projection, null, null, null);
            if (cursor == null) return null;

            int idIndex = cursor.getColumnIndex(MediaStore.MediaColumns._ID);
            int dataIndex = cursor.getColumnIndex(MediaStore.MediaColumns.DATA);
            while (cursor.moveToNext()) {
                String path = dataIndex >= 0 ? cursor.getString(dataIndex) : null;
                if (path == null) continue;
                if (sameFile(path, absolutePath)) {
                    long id = cursor.getLong(idIndex);
                    return Uri.withAppendedPath(collection, String.valueOf(id));
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (cursor != null) cursor.close();
        }
        return null;
    }

    private boolean sameFile(String a, String b) {
        try {
            return new File(a).getCanonicalPath().equals(new File(b).getCanonicalPath());
        } catch (Exception ignored) {
            return a.equals(b);
        }
    }
}
