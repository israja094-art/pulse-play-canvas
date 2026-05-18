import { videos as defaultVideos, songs as defaultSongs, type Video, type Song } from "./media-data";

type Listener = () => void;

const VIDEO_EXT = /\.(mp4|m4v|mov|mkv|webm|3gp|avi|flv|ts)$/i;
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|amr|wma)$/i;

const VIDEO_THUMB_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" rx="18" fill="#111827"/><circle cx="160" cy="90" r="32" fill="#ffffff22"/><path d="M148 70v40l30-20-30-20z" fill="#f8fafc"/></svg>`,
  );
const SONG_COVER_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" rx="28" fill="#111827"/><circle cx="150" cy="150" r="82" fill="#ffffff14"/><circle cx="150" cy="150" r="22" fill="#f8fafc"/></svg>`,
  );

let nativeVideos: Video[] = [];
let nativeSongs: Song[] = [];
const listeners = new Set<Listener>();

const emit = () => listeners.forEach((l) => l());

export const subscribeNativeMedia = (l: Listener) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const getNativeVideos = () => nativeVideos;
export const getNativeSongs = () => nativeSongs;

export const getMergedVideos = (): Video[] =>
  nativeVideos.length ? nativeVideos : defaultVideos;

export const getMergedSongs = (): Song[] => (nativeSongs.length ? nativeSongs : defaultSongs);

const isCapacitorNative = (): boolean => {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
};

const titleFromPath = (p: string) =>
  decodeURIComponent(p.split("/").pop() || p).replace(/\.[^.]+$/, "");

const ANDROID_MEDIA_DIRS = [
  "Movies",
  "DCIM",
  "DCIM/Camera",
  "Download",
  "Downloads",
  "Music",
  "Audio",
  "Recordings",
  "Podcasts",
  "Ringtones",
  "Notifications",
  "Alarms",
  "WhatsApp/Media/WhatsApp Video",
  "WhatsApp/Media/WhatsApp Audio",
  "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Video",
  "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Audio",
];

type ScanResult = { videos: Video[]; songs: Song[] };

const scanDir = async (
  Filesystem: any,
  Directory: any,
  Capacitor: any,
  base: string,
  depth: number,
  out: ScanResult,
) => {
  if (depth < 0) return;
  let entries: Array<{ name: string; type: string; uri: string }> = [];
  try {
    const res = await Filesystem.readdir({ path: base, directory: Directory.ExternalStorage });
    entries = res.files || [];
  } catch {
    return;
  }
  for (const entry of entries) {
    const childPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.type === "directory") {
      // skip hidden / system dirs
      if (entry.name.startsWith(".") || entry.name === "Android") {
        if (entry.name !== "Android") continue;
      }
      await scanDir(Filesystem, Directory, Capacitor, childPath, depth - 1, out);
    } else {
      const uri =
        entry.uri ||
        (await Filesystem.getUri({ path: childPath, directory: Directory.ExternalStorage })).uri;
      const playable = Capacitor.convertFileSrc(uri);
      if (VIDEO_EXT.test(entry.name)) {
        out.videos.push({
          id: `nv-${uri}`,
          title: titleFromPath(entry.name),
          duration: "",
          thumb: VIDEO_THUMB_PLACEHOLDER,
          src: playable,
        });
      } else if (AUDIO_EXT.test(entry.name)) {
        out.songs.push({
          id: `ns-${uri}`,
          title: titleFromPath(entry.name),
          artist: "Device audio",
          duration: "",
          cover: SONG_COVER_PLACEHOLDER,
          src: playable,
        });
      }
    }
  }
};

let scanning = false;
let lastScan = 0;

export const runNativeScan = async (force = false): Promise<void> => {
  if (!isCapacitorNative()) return;
  if (scanning) return;
  if (!force && Date.now() - lastScan < 5000) return;
  scanning = true;
  try {
    const fsMod: any = await import(/* @vite-ignore */ "@capacitor/filesystem" as string);
    const coreMod: any = await import(/* @vite-ignore */ "@capacitor/core" as string);
    const Filesystem = fsMod.Filesystem;
    const Directory = fsMod.Directory;
    const Capacitor = coreMod.Capacitor;

    try {
      const perm = await Filesystem.checkPermissions();
      if (perm.publicStorage !== "granted") {
        await Filesystem.requestPermissions();
      }
    } catch {
      /* ignore — some platforms don't require */
    }

    const out: ScanResult = { videos: [], songs: [] };
    // shallow root scan first
    await scanDir(Filesystem, Directory, Capacitor, "", 1, out);
    // deeper scan in well-known folders
    for (const dir of ANDROID_MEDIA_DIRS) {
      await scanDir(Filesystem, Directory, Capacitor, dir, 3, out);
    }

    // dedupe by src
    const seenV = new Set<string>();
    nativeVideos = out.videos.filter((v) => (seenV.has(v.src) ? false : (seenV.add(v.src), true)));
    const seenS = new Set<string>();
    nativeSongs = out.songs.filter((s) => (seenS.has(s.src) ? false : (seenS.add(s.src), true)));
    lastScan = Date.now();
    emit();
  } catch (err) {
    console.warn("native scan failed", err);
  } finally {
    scanning = false;
  }
};

let appResumeWired = false;
export const wireAutoRescan = async () => {
  if (appResumeWired || !isCapacitorNative()) return;
  appResumeWired = true;
  try {
    const appMod: any = await import(/* @vite-ignore */ "@capacitor/app" as string);
    const App = appMod.App;
    App.addListener("appStateChange", (state: { isActive: boolean }) => {
      if (state.isActive) void runNativeScan(true);
    });
    App.addListener("resume" as any, () => void runNativeScan(true));
  } catch {
    /* plugin missing */
  }
  // periodic safety net in case fs events are missed
  setInterval(() => void runNativeScan(false), 20_000);
};
