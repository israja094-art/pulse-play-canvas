import { useEffect, useState } from "react";
import { isNativePlatform, requestMediaPermissions } from "@/lib/native-ui";
import { runNativeScan } from "@/lib/native-scanner";

const KEY = "zabplay.perm.asked";

export function PermissionGate() {
  const [open, setOpen] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!isNativePlatform()) return;
    try {
      if (localStorage.getItem(KEY) === "granted") return;
    } catch {
      /* ignore */
    }
    setOpen(true);
  }, []);

  if (!open) return null;

  const allow = async () => {
    const ok = await requestMediaPermissions();
    if (ok) {
      try {
        localStorage.setItem(KEY, "granted");
      } catch {
        /* ignore */
      }
      setOpen(false);
      void runNativeScan(true);
    } else {
      setDenied(true);
    }
  };

  const later = () => {
    try {
      localStorage.setItem(KEY, "later");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-6">
      <div className="bg-card text-card-foreground rounded-2xl p-5 max-w-sm w-full space-y-3 border border-border">
        <h2 className="text-lg font-semibold">Allow access to your media</h2>
        <p className="text-sm text-muted-foreground">
          ZabPlay needs permission to read videos and music from your phone's gallery so they show up
          automatically. Your files never leave your device.
        </p>
        {denied && (
          <p className="text-xs text-destructive">
            Permission was not granted. Open Settings → Apps → ZabPlay → Permissions, and allow Music
            & audio and Photos & videos, then reopen the app.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={later}
            className="px-3 py-2 text-sm rounded-md bg-secondary text-secondary-foreground"
          >
            Later
          </button>
          <button
            onClick={allow}
            className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
