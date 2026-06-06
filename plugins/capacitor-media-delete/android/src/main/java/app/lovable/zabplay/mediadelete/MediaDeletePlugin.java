package app.lovable.zabplay.mediadelete;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.IntentSender;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "MediaDelete")
public class MediaDeletePlugin extends Plugin {
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
                Activity activity = getActivity();
                if (activity == null) {
                    call.reject("No activity available");
                    return;
                }
                
                // Capacitor के नए वर्जन के लिए सही तरीका (Fix for startIntentSenderForResult)
                Intent intent = new Intent();
                intent.putExtra("intent_sender", pendingIntent.getIntentSender());
                startActivityForResult(call, intent, "deleteMediaResult");
                return;
            }

            ContentResolver resolver = getContext().getContentResolver();
            int deleted = 0;
            for (Uri uri : mediaUris) {
                deleted += resolver.delete(uri, null, null);
            }

            JSObject res = new JSObject();
            res.put("deleted", deleted > 0);
            res.put("count", deleted);
            call.resolve(res);
        } catch (Exception ex) {
            call.reject("delete-failed", ex);
        }
    }

    @ActivityCallback
    private void deleteMediaResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        boolean ok = result.getResultCode() == Activity.RESULT_OK;
        JSObject res = new JSObject();
        res.put("deleted", ok);
        res.put("count", ok ? 1 : 0);
        call.resolve(res);
    }

    private Uri resolveMediaUri(String rawPath) {
        if (rawPath == null || rawPath.isEmpty()) return null;
        String normalized = rawPath
            .replace("file://", "")
            .replace("/sdcard/", "/storage/emulated/0/");

        Uri direct = Uri.parse(normalized);
        if ("content".equalsIgnoreCase(direct.getScheme())) {
            return direct;
        }

        Uri videoUri = queryUri(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, normalized);
        if (videoUri != null) return videoUri;
        Uri audioUri = queryUri(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, normalized);
        if (audioUri != null) return audioUri;
        Uri imageUri = queryUri(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, normalized);
        if (imageUri != null) return imageUri;
        Uri filesUri = queryUri(MediaStore.Files.getContentUri("external"), normalized);
        if (filesUri != null) return filesUri;
        return null;
    }

    private Uri queryUri(Uri collection, String absolutePath) {
        ContentResolver resolver = getContext().getContentResolver();
        String[] projection = new String[] {
            MediaStore.MediaColumns._ID,
            MediaStore.MediaColumns.DATA,
            MediaStore.MediaColumns.RELATIVE_PATH,
            MediaStore.MediaColumns.DISPLAY_NAME
        };
        Cursor cursor = null;
        try {
            cursor = resolver.query(collection, projection, null, null, null);
            if (cursor == null) return null;

            int idIndex = cursor.getColumnIndex(MediaStore.MediaColumns._ID);
            int dataIndex = cursor.getColumnIndex(MediaStore.MediaColumns.DATA);
            int relativeIndex = cursor.getColumnIndex(MediaStore.MediaColumns.RELATIVE_PATH);
            int displayNameIndex = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME);
            while (cursor.moveToNext()) {
                String path = dataIndex >= 0 ? cursor.getString(dataIndex) : null;
                String relativePath = relativeIndex >= 0 ? cursor.getString(relativeIndex) : null;
                String displayName = displayNameIndex >= 0 ? cursor.getString(displayNameIndex) : null;
                if (matchesPath(path, relativePath, displayName, absolutePath)) {
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

    private boolean matchesPath(String dataPath, String relativePath, String displayName, String absolutePath) {
        if (dataPath != null && sameFile(dataPath, absolutePath)) {
            return true;
        }
        if (relativePath == null || displayName == null) {
            return false;
        }

        String rel = relativePath.replaceAll("^/+", "");
        String candidate = Environment.getExternalStorageDirectory().getAbsolutePath() + "/" + rel + displayName;
        return sameFile(candidate, absolutePath);
    }

    private boolean sameFile(String a, String b) {
        try {
            return new File(a).getCanonicalPath().equals(new File(b).getCanonicalPath());
        } catch (Exception ignored) {
            return a.equals(b);
        }
    }
}
