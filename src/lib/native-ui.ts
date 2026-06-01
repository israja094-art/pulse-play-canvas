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
    await fs.Filesystem.deleteFile({ path: uri });
    return true;
  } catch (e) {
    console.warn("delete failed", e);
    return false;
  }
};

// ---------- Permissions ----------
export const requestMediaPermissions = async (): Promise<boolean> => {
  if (!isNative()) return true;
  let granted = false;

  try {
    const fs: any = await import(/* @vite-ignore */ ("@capacitor/filesystem" as string));
    const res = await fs.Filesystem.requestPermissions();
    if (res?.publicStorage === "granted") granted = true;
  } catch (e) {
    console.warn("filesystem permission request failed", e);
  }

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

// ---------- Status bar / Navigation bar ----------
// Both bars are kept BLACK with light icons and VISIBLE during normal use.
// They are only hidden while a video is in fullscreen (landscape).

const setStatusBarBlack = async () => {
  try {
    const sb: any = await import(/* @vite-ignore */ ("@capacitor/status-bar" as string));
    // Don't draw the webview under the bar — avoids a white strip at the top.
    await sb.StatusBar.setOverlaysWebView?.({ overlay: false });
    await sb.StatusBar.setBackgroundColor?.({ color: "#000000" });
    // Style.Dark => dark background with light (white) icons.
    await sb.StatusBar.setStyle?.({ style: sb.Style?.Dark ?? "DARK" });
    await sb.StatusBar.show?.();
  } catch {
    /* plugin missing */
  }
};

const setNavBarBlack = async () => {
  try {
    const nb: any = await import(
      /* @vite-ignore */ ("@hugotomazi/capacitor-navigation-bar" as string)
    );
    await nb.NavigationBar.setColor?.({ color: "#000000", darkButtons: false });
    await nb.NavigationBar.show?.();
  } catch {
    /* plugin missing */
  }
};

const hideStatusBar = async () => {
  try {
    const sb: any = await import(/* @vite-ignore */ ("@capacitor/status-bar" as string));
    await sb.StatusBar.setOverlaysWebView?.({ overlay: true });
    await sb.StatusBar.hide?.();
  } catch {
    /* plugin missing */
  }
};

const hideNavBar = async () => {
  try {
    const nb: any = await import(
      /* @vite-ignore */ ("@hugotomazi/capacitor-navigation-bar" as string)
    );
    await nb.NavigationBar.hide?.();
  } catch {
    /* plugin missing */
  }
};

// Hide both system bars (used ONLY for fullscreen video).
export const hideSystemUi = async () => {
  if (!isNative()) return;
  await Promise.all([hideStatusBar(), hideNavBar()]);
};

// Restore both system bars as solid BLACK bars with light content.
export const showSystemUi = async () => {
  if (!isNative()) return;
  await Promise.all([setStatusBarBlack(), setNavBarBlack()]);
};

// Set up the persistent black, always-visible system bars on launch.
export const initImmersive = () => {
  if (!isNative()) return;
  void showSystemUi();
  // Re-apply after first paint in case the OEM resets bar colors late.
  setTimeout(() => void showSystemUi(), 700);
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
