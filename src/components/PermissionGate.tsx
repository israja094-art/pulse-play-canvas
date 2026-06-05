import { useEffect, useState } from "react";
import { isNativePlatform, requestMediaPermissions } from "@/lib/native-ui";
import { runNativeScan } from "@/lib/native-scanner";

const KEY = "zabplay.perm.granted";

export function PermissionGate() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!isNativePlatform()) return;
    try {
      if (localStorage.getItem(KEY) === "1") {
        // Already granted earlier — still kick a scan.
        void runNativeScan(true);
        return;
      }
    } catch {
      /* ignore */
    }
    // Always show on launch until permissions are granted.
    setOpen(true);
  }, []);

  if (!open) return null;

  const allow = async () => {
    setBusy(true);
    const ok = await requestMediaPermissions();
    setBusy(false);
    if (ok) {
      try {
        localStorage.setItem(KEY, "1");
      } catch {
        /* ignore */
      }
      setOpen(false);
      void runNativeScan(true);
    } else {
      setDenied(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-6">
      <div className="bg-card text-card-foreground rounded-2xl p-5 max-w-sm w-full space-y-3 border border-border shadow-2xl">
        <h2 className="text-lg font-semibold">Allow access to Videos & Music</h2>
        <p className="text-sm text-muted-foreground">
          ZabPlay needs permission to read videos and music from your phone so they show up
          automatically from the gallery and so Android can confirm permanent delete requests. Your files never leave your device.
        </p>
        {denied && (
          <p className="text-xs text-destructive">
            Permission was not granted. Open Settings → Apps → ZabPlay → Permissions, and allow
            <b> Music & audio </b> and <b> Photos & videos </b>, then reopen the app.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={allow}
            disabled={busy}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Requesting…" : "Allow"}
          </button>
        </div>
      </div>
    </div>
  );
}
