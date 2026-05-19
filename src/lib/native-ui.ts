// Native Android bridges. All dynamic imports are guarded so the web build
// keeps working even when the Capacitor plugins are absent.

const isNative = (): boolean => {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
};

export const isNativePlatform = isNative;

// ---------- Share ----------
export const nativeShare = async (
  title: string,
  text: string,
  url?: string,
): Promise<boolean> => {
  if (isNative()) {
    try {
      const mod: any = await import(/* @vite-ignore */ ("@capacitor/share" as string));
      await mod.Share.share({ title, text, url, dialogTitle: title });
      return true;
    } catch (e) {
      console.warn("native share failed", e);
    }
  }
  const navAny = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (navAny.share) {
    try {
      await navAny.share({ title, text, url });
      return true;
    } catch {
      /* user dismissed */
    }
  }
  try {
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
    alert("Link copied to clipboard");
    return true;
  } catch {
    alert(text);
  }
  return false;
};

// ---------- Filesystem delete ----------
export const nativeDeleteFile = async (uri: string): Promise<boolean> => {
  if (!isNative()) return false;
  try {
    const fs: any = await import(/* @vite-ignore */ ("@capacitor/filesystem" as string));
    // Capacitor accepts either `path` (with directory) or a full file:// URI via `path`.
    await fs.Filesystem.deleteFile({ path: uri });
    return true;
  } catch (e) {
    console.warn("delete failed", e);
    return false;
  }
};

// ---------- Permissions ----------
// Try multiple plugin paths so the OS-level dialog actually appears for both
// READ_MEDIA_VIDEO and READ_MEDIA_AUDIO on Android 13+.
export const requestMediaPermissions = async (): Promise<boolean> => {
  if (!isNative()) return true;
  let granted = false;

  // 1) Filesystem.requestPermissions — covers legacy READ_EXTERNAL_STORAGE
  //    and (on some OEMs) the media group.
  try {
    const fs: any = await import(/* @vite-ignore */ ("@capacitor/filesystem" as string));
    const res = await fs.Filesystem.requestPermissions();
    if (res?.publicStorage === "granted") granted = true;
  } catch (e) {
    console.warn("filesystem permission request failed", e);
  }

  // 2) @capacitor-community/media — explicitly requests READ_MEDIA_VIDEO /
  //    READ_MEDIA_AUDIO on Android 13+. Optional plugin: if not installed,
  //    we silently fall back to whatever Filesystem returned above.
  try {
    const media: any = await import(
      /* @vite-ignore */ ("@capacitor-community/media" as string)
    );
    const res = await media.Media.requestPermissions?.();
    const ok =
      res?.publicStorage === "granted" ||
      res?.readMediaVideo === "granted" ||
      res?.readMediaAudio === "granted" ||
      res?.granted === true;
    if (ok) granted = true;
  } catch {
    /* plugin not present — ignore */
  }

  return granted;
};

// ---------- Immersive system UI (status bar + nav bar) ----------
let revealTimer: ReturnType<typeof setTimeout> | null = null;
let immersiveInitialised = false;

const hideStatusBar = async () => {
  try {
    const sb: any = await import(/* @vite-ignore */ ("@capacitor/status-bar" as string));
    await sb.StatusBar.hide();
  } catch {
    /* plugin missing */
  }
};

const showStatusBar = async () => {
  try {
    const sb: any = await import(/* @vite-ignore */ ("@capacitor/status-bar" as string));
    await sb.StatusBar.show();
  } catch {
    /* plugin missing */
  }
};

const hideNavBar = async () => {
  try {
    const nb: any = await import(
      /* @vite-ignore */ ("@hugotomazi/capacitor-navigation-bar" as string)
    );
    await nb.NavigationBar.hide();
  } catch {
    /* plugin missing */
  }
};

const showNavBar = async () => {
  try {
    const nb: any = await import(
      /* @vite-ignore */ ("@hugotomazi/capacitor-navigation-bar" as string)
    );
    await nb.NavigationBar.show();
  } catch {
    /* plugin missing */
  }
};

export const hideSystemUi = async () => {
  if (!isNative()) return;
  await Promise.all([hideStatusBar(), hideNavBar()]);
};

export const showSystemUi = async () => {
  if (!isNative()) return;
  await Promise.all([showStatusBar(), showNavBar()]);
};

export const revealSystemUiBriefly = (ms = 3000) => {
  if (!isNative()) return;
  void showSystemUi();
  if (revealTimer) clearTimeout(revealTimer);
  revealTimer = setTimeout(() => {
    void hideSystemUi();
  }, ms);
};

export const initImmersive = () => {
  if (immersiveInitialised || !isNative()) return;
  immersiveInitialised = true;
  // Initial hide after first paint.
  setTimeout(() => void hideSystemUi(), 700);
  // Any user touch briefly reveals system bars, then hides again.
  const onTouch = () => revealSystemUiBriefly(3000);
  window.addEventListener("touchstart", onTouch, { passive: true });
};

// ---------- Screen orientation ----------
export const lockOrientation = async (orientation: "landscape" | "portrait") => {
  if (isNative()) {
    try {
      const so: any = await import(
        /* @vite-ignore */ ("@capacitor/screen-orientation" as string)
      );
      await so.ScreenOrientation.lock({ orientation });
      return;
    } catch (e) {
      console.warn("orientation lock failed", e);
    }
  }
  try {
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })
      .lock?.(orientation);
  } catch {
    /* ignore */
  }
};

export const unlockOrientation = async () => {
  if (isNative()) {
    try {
      const so: any = await import(
        /* @vite-ignore */ ("@capacitor/screen-orientation" as string)
      );
      await so.ScreenOrientation.unlock();
      return;
    } catch {
      /* ignore */
    }
  }
  try {
    (screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.();
  } catch {
    /* ignore */
  }
};
