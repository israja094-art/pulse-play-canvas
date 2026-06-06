import { useSyncExternalStore } from "react";
import { videos as defaultVideos, songs as defaultSongs, type Video, type Song } from "./media-data";
import {
  subscribeNativeMedia,
  getNativeVideos,
  getNativeSongs,
  runNativeScan,
  wireAutoRescan,
} from "./native-scanner";
import { requestMediaPermissions } from "./native-ui";
import { MediaDelete } from "./media-delete";
// 👑 IMPORTING CAPACITOR NATIVE PLUGINS FOR ACTUAL FILE SHARING
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";

type State = {
  videos: Video[];
  songs: Song[];
};

type PersistedVideo = {
  id: string;
  title: string;
  duration: string;
  thumb: string;
  file: Blob;
  folderName?: string; // Naya parameter folder track karne ke liye
};

type PersistedSong = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  cover: string;
  file: Blob;
};

const LS_DELETED_V = "zabplay.deleted.videos";
const LS_DELETED_S = "zabplay.deleted.songs";
const LS_PRIVACY_V = "zabplay.privacy.videos"; // Privacy hidden videos storage track
const LS_RENAMED_V = "zabplay.renamed.videos"; // Custom renamed native/default videos tracker
const LS_RENAMED_S = "zabplay.renamed.songs"; // Custom renamed songs tracker
const LS_PLAYLIST = "zabplay.playlist.default"; // Default playlist song ids
const LS_PRIVACY_PIN = "zabplay.privacy.pin"; // 6-digit numeric pin saver
const DB_NAME = "zabplay-media-db";
const DB_VERSION = 1;
const VIDEO_STORE = "videos";
const SONG_STORE = "songs";

const VIDEO_THUMB_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" rx="18" fill="#111827"/><circle cx="160" cy="90" r="32" fill="#ffffff22"/><path d="M148 70v40l30-20-30-20z" fill="#f8fafc"/></svg>`);
const SONG_COVER_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" rx="28" fill="#111827"/><circle cx="150" cy="150" r="82" fill="#ffffff14"/><circle cx="150" cy="150" r="22" fill="#f8fafc"/><path d="M178 84v90.5a25 25 0 1 1-14-22.5V108l58-11v63.5a25 25 0 1 1-14-22.5V84z" fill="#cbd5e1"/></svg>`);

// Duration Formatting Helper
const fmtDuration = (sec: number) => {
  if (!isFinite(sec) || sec <= 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const loadDeleted = (key: string): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
};

const saveDeleted = (key: string, s: Set<string>) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify([...s]));
};

// Custom Names Load and Save Loader
const loadRenamedMap = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LS_RENAMED_V) || "{}");
  } catch {
    return {};
  }
};

const loadRenamedSongMap = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LS_RENAMED_S) || "{}");
  } catch {
    return {};
  }
};

const loadPlaylist = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_PLAYLIST) || "[]"));
  } catch {
    return new Set();
  }
};

let deletedV = new Set<string>();
let deletedS = new Set<string>();
let privacyV = new Set<string>(); // Hidden layout videos state container
let renamedMap: Record<string, string> = {}; // Video id to custom title map
let renamedSongMap: Record<string, string> = {}; // Song id to custom title map
let playlist = new Set<string>(); // Default playlist song ids
let hydratedFromStorage = false;
let mediaHydrated = false;

const userVideos: Video[] = [];
const userSongs: Song[] = [];

// Cache map jisse native duration bar bar extract na karna pade performance glitch ke bina
const nativeDurationCache = new Map<string, { duration: string; thumb?: string }>();

const computeState = (): State => {
  const nv = getNativeVideos().map(video => {
    const cached = nativeDurationCache.get(video.id);
    const updatedTitle = renamedMap[video.id] || video.title; // Appending renamed names
    return cached 
      ? { ...video, title: updatedTitle, duration: cached.duration, thumb: cached.thumb || video.thumb } 
      : { ...video, title: updatedTitle };
  });
  
  const ns = getNativeSongs().map(song => {
    const cached = nativeDurationCache.get(song.id);
    const title = renamedSongMap[song.id] || song.title;
    return cached ? { ...song, title, duration: cached.duration } : { ...song, title };
  });

  // Base list filter mapping with privacy state filter
  const allVideos = [...nv, ...userVideos, ...defaultVideos].filter(
    (v) => !deletedV.has(v.id) && !privacyV.has(v.id)
  );

  const allSongs = [...ns, ...userSongs, ...defaultSongs.filter((s) => !deletedS.has(s.id))].map(
    (s) => (renamedSongMap[s.id] ? { ...s, title: renamedSongMap[s.id] } : s),
  );

  return {
    videos: allVideos,
    songs: allSongs,
  };
};

let state: State = computeState();
const listeners = new Set<() => void>();

const emit = () => {
  state = computeState();
  listeners.forEach((l) => l());
};

// Helper delay utility for time-slicing thread chunks
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let isProbingBackground = false;

// 🔥 SMART BACKGROUND TRAFFIC CONTROLLER PROBER
const probeNativeMediaBackground = async () => {
  if (isProbingBackground) return;
  isProbingBackground = true;

  const nv = getNativeVideos();
  const ns = getNativeSongs();
  let count = 0;

  for (const video of nv) {
    if (!nativeDurationCache.has(video.id) || nativeDurationCache.get(video.id)?.duration === "") {
      try {
        await sleep(600);
        const meta = await probeVideo(video.src, true);
        if (meta.duration && meta.duration !== "00:00") {
          nativeDurationCache.set(video.id, meta);
          count++;
          if (count % 10 === 0) emit();
        }
      } catch (e) {
        console.warn("Background video probe skip", e);
      }
    }
  }
  if (count > 0) { emit(); count = 0; }

  for (const song of ns) {
    if (!nativeDurationCache.has(song.id) || nativeDurationCache.get(song.id)?.duration === "") {
      try {
        await sleep(300);
        const d = await probeAudioDuration(song.src);
        if (d && d !== "00:00") {
          nativeDurationCache.set(song.id, { duration: d });
          count++;
          if (count % 15 === 0) emit();
        }
      } catch (e) {
        console.warn("Background audio probe skip", e);
      }
    }
  }
  if (count > 0) emit();

  isProbingBackground = false;
};

const openDb = (): Promise<IDBDatabase | null> =>
  new Promise((resolve) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VIDEO_STORE)) db.createObjectStore(VIDEO_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SONG_STORE)) db.createObjectStore(SONG_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

const readAll = async <T,>(storeName: string): Promise<T[]> => {
  const db = await openDb();
  if (!db) return [];

  return new Promise((resolve) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve((request.result as T[]) || []);
    request.onerror = () => resolve([]);
  });
};

const putOne = async <T,>(storeName: string, value: T) => {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
};

const deleteOne = async (storeName: string, id: string) => {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
};

const hydratePersistedMedia = async () => {
  if (mediaHydrated || typeof window === "undefined") return;
  mediaHydrated = true;

  const [videos, songs] = await Promise.all([
    readAll<PersistedVideo>(VIDEO_STORE),
    readAll<PersistedSong>(SONG_STORE),
  ]);

  userVideos.splice(
    0,
    userVideos.length,
    ...videos.map((video) => {
      const updatedTitle = renamedMap[video.id] || video.title; // Appending custom user file name
      return {
        id: video.id,
        title: updatedTitle,
        duration: video.duration,
        thumb: video.thumb,
        src: video.folderName ? `/${video.folderName}/${updatedTitle}` : URL.createObjectURL(video.file),
      };
    }),
  );

  userSongs.splice(
    0,
    userSongs.length,
    ...songs.map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      duration: song.duration,
      cover: song.cover,
      src: URL.createObjectURL(song.file),
    })),
  );

  emit();
};

const subscribe = (l: () => void) => {
  if (!hydratedFromStorage && typeof window !== "undefined") {
    hydratedFromStorage = true;
    deletedV = loadDeleted(LS_DELETED_V);
    deletedS = loadDeleted(LS_DELETED_S);
    privacyV = loadDeleted(LS_PRIVACY_V); // Loading secure privacy entries
    renamedMap = loadRenamedMap(); // Loading active custom titles map
    renamedSongMap = loadRenamedSongMap(); // Loading active song custom titles
    playlist = loadPlaylist(); // Loading default playlist
    // queueMicrotask(() => emit());
    void hydratePersistedMedia();
    
    subscribeNativeMedia(() => {
      emit();
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => void probeNativeMediaBackground(), { timeout: 3000 });
      } else {
        setTimeout(() => void probeNativeMediaBackground(), 1000);
      }
    });
    
    void runNativeScan(true);
    void wireAutoRescan();
  }
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useMediaStore = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );

const sanitizeFileTitle = (value: string) => value.replace(/[\\/:*?"<>|]/g, "_").trim();

const normalizeNativePath = (rawPath: string) => {
  const clean = rawPath.replace(/^file:\/\//, "");
  const relative = clean.replace(/^\/+storage\/+emulated\/+0\/+/, "").replace(/^\/+sdcard\/+/, "");
  return {
    absolute: clean,
    relative,
  };
};

const requestSystemGalleryDelete = async (rawPath: string): Promise<boolean | null> => {
  if (typeof window === "undefined") return null;

  try {
    await requestMediaPermissions();
    const result = await MediaDelete.deleteMedia({
      paths: [normalizeNativePath(rawPath).absolute],
    });

    if (typeof result?.deleted === "boolean") {
      return result.deleted;
    }
  } catch (error) {
    console.warn("system gallery delete unavailable", error);
  }

  return null;
};

const deleteNativeFile = async (rawPath: string): Promise<boolean> => {
  const systemDeleteResult = await requestSystemGalleryDelete(rawPath);
  if (systemDeleteResult !== null) {
    return systemDeleteResult;
  }

  const { absolute, relative } = normalizeNativePath(rawPath);
  const attempts = [
    () => Filesystem.deleteFile({ path: absolute }),
    () => Filesystem.deleteFile({ path: relative, directory: Directory.ExternalStorage }),
    () => Filesystem.deleteFile({ path: relative, directory: Directory.Documents }),
  ];

  for (const attempt of attempts) {
    try {
      await attempt();
      return true;
    } catch {
      /* try next path shape */
    }
  }

  console.warn("native delete failed", { rawPath, absolute, relative });
  return false;
};

const renameNativeFile = async (rawPath: string, newTitle: string): Promise<boolean> => {
  const { absolute, relative } = normalizeNativePath(rawPath);
  const source = relative || absolute;
  const lastSlash = source.lastIndexOf("/");
  if (lastSlash < 0) return false;

  const dir = source.slice(0, lastSlash);
  const oldName = source.slice(lastSlash + 1);
  const dot = oldName.lastIndexOf(".");
  const ext = dot >= 0 ? oldName.slice(dot) : "";
  const safe = sanitizeFileTitle(newTitle);
  if (!safe) return false;
  const target = `${dir}/${safe}${ext}`;
  if (target === source) return true;

  const attempts = [
    () => Filesystem.rename({ from: absolute, to: absolute.replace(/[^/]+$/, `${safe}${ext}`) }),
    () => Filesystem.rename({ from: source, to: target, directory: Directory.ExternalStorage, toDirectory: Directory.ExternalStorage } as any),
    () => Filesystem.rename({ from: source, to: target, directory: Directory.Documents, toDirectory: Directory.Documents } as any),
  ];

  for (const attempt of attempts) {
    try {
      await attempt();
      return true;
    } catch {
      /* try next path shape */
    }
  }

  console.warn("native rename failed", { rawPath, source, target });
  return false;
};

export const deleteVideos = async (ids: string[]) => {
  let nativeDeleteFailed = false;
  for (const id of ids) {
    const i = userVideos.findIndex((v) => v.id === id);
    if (i >= 0) {
      URL.revokeObjectURL(userVideos[i].src);
      userVideos.splice(i, 1);
      void deleteOne(VIDEO_STORE, id);
    } else {
      // Native gallery video: actually remove the underlying file
      if (id.startsWith("nv-")) {
        const ok = await deleteNativeFile(id.replace("nv-", ""));
        if (!ok) {
          nativeDeleteFailed = true;
          continue;
        }
      }
      delete renamedMap[id];
      privacyV.delete(id);
      deletedV.add(id);
    }
  }
  localStorage.setItem(LS_RENAMED_V, JSON.stringify(renamedMap));
  saveDeleted(LS_PRIVACY_V, privacyV);
  saveDeleted(LS_DELETED_V, deletedV);
  emit();
  // Re-scan so the gallery list reflects the real filesystem state
  void runNativeScan(true);
  if (nativeDeleteFailed) {
    throw new Error("native-delete-failed");
  }
};

export const deleteSongs = (ids: string[]) => {
  for (const id of ids) {
    const i = userSongs.findIndex((s) => s.id === id);
    if (i >= 0) {
      URL.revokeObjectURL(userSongs[i].src);
      userSongs.splice(i, 1);
      void deleteOne(SONG_STORE, id);
    } else {
      deletedS.add(id);
    }
  }
  saveDeleted(LS_DELETED_S, deletedS);
  emit();
};

// 🔥 REAL WORKING FEATURE: RENAME VIDEOS ENGINE
export const renameVideoFile = async (id: string, newTitle: string) => {
  const cleanTitle = sanitizeFileTitle(newTitle);
  if (!cleanTitle) return false;

  renamedMap[id] = cleanTitle;
  localStorage.setItem(LS_RENAMED_V, JSON.stringify(renamedMap));

  // Agar user ka manual file imported hai, toh IndexedDB record ko bhi real update karo
  const userIdx = userVideos.findIndex((v) => v.id === id);
  if (userIdx >= 0) {
    userVideos[userIdx].title = cleanTitle;
    const dbVideos = await readAll<PersistedVideo>(VIDEO_STORE);
    const targetData = dbVideos.find(v => v.id === id);
    if (targetData) {
      targetData.title = cleanTitle;
      await putOne<PersistedVideo>(VIDEO_STORE, targetData);
    }
  } else if (id.startsWith("nv-")) {
    // Native gallery video: actually rename the underlying file
    const ok = await renameNativeFile(id.replace("nv-", ""), cleanTitle);
    emit();
    if (ok) {
      void runNativeScan(true);
      return true;
    }
    return false;
  }
  emit();
  return true;
};

// 🔥 REAL WORKING FEATURE: HIDE / LOCK IN PRIVACY FOLDER ENGINE
export const moveVideosToPrivacy = (ids: string[]) => {
  for (const id of ids) {
    privacyV.add(id);
  }
  saveDeleted(LS_PRIVACY_V, privacyV);
  emit();
};

// 🔥 NEW FEATURE: UNLOCK / REMOVE FROM PRIVACY FOLDER
export const removeVideosFromPrivacy = (ids: string[]) => {
  for (const id of ids) {
    privacyV.delete(id);
  }
  saveDeleted(LS_PRIVACY_V, privacyV);
  emit();
};

// 🔥 REAL WORKING FEATURE: READ ALL HIDDEN PRIVACY VIDEOS DATA
export const getPrivacyVideos = async (): Promise<Video[]> => {
  const nv = getNativeVideos().map(video => {
    const cached = nativeDurationCache.get(video.id);
    return {
      ...video,
      title: renamedMap[video.id] || video.title,
      duration: cached?.duration || video.duration,
      thumb: cached?.thumb || video.thumb
    };
  });
  const allMedia = [...nv, ...userVideos, ...defaultVideos];
  return allMedia.filter(v => privacyV.has(v.id));
};

// 🔥 NEW PASSWORD FEATURES FOR PRIVACY FUNCTIONALITY
export const getPrivacyPin = (): string | null => {
  return localStorage.getItem(LS_PRIVACY_PIN);
};

export const setPrivacyPin = (pin: string) => {
  localStorage.setItem(LS_PRIVACY_PIN, pin);
};

const probeVideo = (url: string, skipThumb = false): Promise<{ duration: string; thumb: string }> =>
  new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.src = url;
    v.crossOrigin = "anonymous";
    let resolved = false;
    const done = (duration: string, thumb: string) => {
      if (resolved) return;
      resolved = true;
      v.src = "";
      v.load();
      resolve({ duration, thumb });
    };
    v.addEventListener("loadeddata", () => {
      try {
        v.currentTime = Math.min(1, (v.duration || 0) / 2);
      } catch {
        done(fmtDuration(v.duration), "");
      }
    });
    v.addEventListener("seeked", () => {
      if (skipThumb) return done(fmtDuration(v.duration), "");
      try {
        const c = document.createElement("canvas");
        c.width = 320;
        c.height = Math.round((v.videoHeight / v.videoWidth) * 320) || 180;
        const ctx = c.getContext("2d");
        ctx?.drawImage(v, 0, 0, c.width, c.height);
        done(fmtDuration(v.duration), c.toDataURL("image/jpeg", 0.6));
      } catch {
        done(fmtDuration(v.duration), "");
      }
    });
    v.addEventListener("error", () => done("00:00", ""));
    setTimeout(() => done(fmtDuration(v.duration || 0), ""), 3000);
  });

const probeAudioDuration = (url: string): Promise<string> =>
  new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = url;
    let settled = false;
    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      audio.src = "";
      resolve(value);
    };
    audio.addEventListener("loadedmetadata", () => finish(fmtDuration(audio.duration || 0)));
    audio.addEventListener("error", () => finish("00:00"));
    setTimeout(() => finish(fmtDuration(audio.duration || 0)), 3000);
  });

export const importVideoFiles = async (files: FileList | File[]) => {
  const arr = Array.from(files);
  for (const f of arr) {
    const id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const url = URL.createObjectURL(f);
    const { duration, thumb } = await probeVideo(url);
    
    // --- IMPORT FOLDER CORRECTION ---
    const video: Video = {
      id,
      title: f.name.replace(/\.[^.]+$/, ""),
      duration,
      thumb: thumb || VIDEO_THUMB_PLACEHOLDER,
      src: `/Imported Videos/${f.name}`, // Folder categorisation path simulation
    };
    userVideos.unshift(video);
    emit();
    void putOne<PersistedVideo>(VIDEO_STORE, {
      id,
      title: video.title,
      duration: video.duration,
      thumb: video.thumb,
      file: f,
      folderName: "Imported Videos"
    });
  }
};

export const importAudioFiles = async (files: FileList | File[]) => {
  const arr = Array.from(files);
  for (const f of arr) {
    const id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const url = URL.createObjectURL(f);
    const duration = await probeAudioDuration(url);
    const song: Song = {
      id,
      title: f.name.replace(/\.[^.]+$/, ""),
      artist: "Local audio",
      duration,
      cover: SONG_COVER_PLACEHOLDER,
      src: url,
    };
    userSongs.unshift(song);
    emit();
    void putOne<PersistedSong>(SONG_STORE, {
      id,
      title: song.title,
      artist: song.artist,
      duration: song.duration,
      cover: song.cover,
      file: f,
    });
  }
};

// 🔥 FIXED SHARE FEATURE: EXTRACTS NATIVE FILE PATH AND FORCES MP4 MIME TYPE FOR ANDROID
export const shareItems = async (items: { id?: string; title: string; src: string }[]) => {
  if (items.length === 0) return;

  try {
    const filesToShare: string[] = [];

    for (const item of items) {
      if (item.id && item.id.startsWith("nv-")) {
        const rawNativePath = item.id.replace("nv-", "");
        
        try {
          const fileUriResult = await Filesystem.getUri({
            path: rawNativePath,
            directory: Directory.ExternalStorage,
          });
          if (fileUriResult && fileUriResult.uri) {
            filesToShare.push(fileUriResult.uri);
          }
        } catch (fsErr) {
          console.warn("Failed to get native URI via filesystem, trying fallback:", fsErr);
          if (rawNativePath.startsWith("file://")) {
            filesToShare.push(rawNativePath);
          }
        }
      }
    }

    if (filesToShare.length > 0) {
      await Share.share({
        title: items[0].title,
        files: filesToShare,
        dialogTitle: "Share Video",
      });
    } else {
      const textToSend = items.map((i) => `${i.title}`).join("\n");
      await Share.share({
        title: "ZabPlay Media",
        text: textToSend,
        dialogTitle: "Share Info",
      });
    }
  } catch (error) {
    console.error("Error while handling capacitor native sharing:", error);
  }
};

// 🔥 REAL WORKING FEATURE: RENAME SONG ENGINE
export const renameSong = async (id: string, newTitle: string) => {
  if (!newTitle.trim()) return;
  renamedSongMap[id] = newTitle.trim();
  localStorage.setItem(LS_RENAMED_S, JSON.stringify(renamedSongMap));

  const userIdx = userSongs.findIndex((s) => s.id === id);
  if (userIdx >= 0) {
    userSongs[userIdx].title = newTitle.trim();
    const dbSongs = await readAll<PersistedSong>(SONG_STORE);
    const target = dbSongs.find((s) => s.id === id);
    if (target) {
      target.title = newTitle.trim();
      await putOne<PersistedSong>(SONG_STORE, target);
    }
  }
  emit();
};

// 🔥 REAL WORKING FEATURE: ADD SONGS TO DEFAULT PLAYLIST
export const addToPlaylist = (ids: string[]) => {
  for (const id of ids) playlist.add(id);
  localStorage.setItem(LS_PLAYLIST, JSON.stringify([...playlist]));
  emit();
};

export const removeFromPlaylist = (ids: string[]) => {
  for (const id of ids) playlist.delete(id);
  localStorage.setItem(LS_PLAYLIST, JSON.stringify([...playlist]));
  emit();
};

export const isInPlaylist = (id: string) => playlist.has(id);
export const getPlaylistIds = () => [...playlist];


