import { useSyncExternalStore } from "react";
import { videos as defaultVideos, songs as defaultSongs, type Video, type Song } from "./media-data";
import {
  subscribeNativeMedia,
  getNativeVideos,
  getNativeSongs,
  runNativeScan,
  wireAutoRescan,
} from "./native-scanner";
import { nativeShare, nativeDeleteFile } from "./native-ui";

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

let deletedV = new Set<string>();
let deletedS = new Set<string>();
let hydratedFromStorage = false;
let mediaHydrated = false;

const userVideos: Video[] = [];
const userSongs: Song[] = [];

const computeState = (): State => {
  const nv = getNativeVideos();
  const ns = getNativeSongs();
  return {
    videos: [...nv, ...userVideos, ...defaultVideos.filter((v) => !deletedV.has(v.id))],
    songs: [...ns, ...userSongs, ...defaultSongs.filter((s) => !deletedS.has(s.id))],
  };
};

let state: State = computeState();
const listeners = new Set<() => void>();

const emit = () => {
  state = computeState();
  listeners.forEach((l) => l());
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
    ...videos.map((video) => ({
      id: video.id,
      title: video.title,
      duration: video.duration,
      thumb: video.thumb,
      src: URL.createObjectURL(video.file),
    })),
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
    queueMicrotask(() => emit());
    void hydratePersistedMedia();
    subscribeNativeMedia(() => emit());
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

export const deleteVideos = (ids: string[]) => {
  for (const id of ids) {
    if (id.startsWith("nv-")) {
      const uri = id.slice(3);
      void nativeDeleteFile(uri).then(() => void runNativeScan(true));
      continue;
    }
    const i = userVideos.findIndex((v) => v.id === id);
    if (i >= 0) {
      URL.revokeObjectURL(userVideos[i].src);
      userVideos.splice(i, 1);
      void deleteOne(VIDEO_STORE, id);
    } else {
      deletedV.add(id);
    }
  }
  saveDeleted(LS_DELETED_V, deletedV);
  emit();
};

export const deleteSongs = (ids: string[]) => {
  for (const id of ids) {
    if (id.startsWith("ns-")) {
      const uri = id.slice(3);
      void nativeDeleteFile(uri).then(() => void runNativeScan(true));
      continue;
    }
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

const fmtDuration = (sec: number) => {
  if (!isFinite(sec) || sec <= 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const probeVideo = (url: string): Promise<{ duration: string; thumb: string }> =>
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
      try {
        const c = document.createElement("canvas");
        c.width = 320;
        c.height = Math.round((v.videoHeight / v.videoWidth) * 320) || 180;
        const ctx = c.getContext("2d");
        ctx?.drawImage(v, 0, 0, c.width, c.height);
        done(fmtDuration(v.duration), c.toDataURL("image/jpeg", 0.7));
      } catch {
        done(fmtDuration(v.duration), "");
      }
    });
    v.addEventListener("error", () => done("00:00", ""));
    setTimeout(() => done(fmtDuration(v.duration || 0), ""), 4000);
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
      resolve(value);
    };
    audio.addEventListener("loadedmetadata", () => finish(fmtDuration(audio.duration || 0)));
    audio.addEventListener("error", () => finish("00:00"));
    setTimeout(() => finish(fmtDuration(audio.duration || 0)), 4000);
  });

export const importVideoFiles = async (files: FileList | File[]) => {
  const arr = Array.from(files);
  for (const f of arr) {
    const id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const url = URL.createObjectURL(f);
    const { duration, thumb } = await probeVideo(url);
    const video: Video = {
      id,
      title: f.name.replace(/\.[^.]+$/, ""),
      duration,
      thumb: thumb || VIDEO_THUMB_PLACEHOLDER,
      src: url,
    };
    userVideos.unshift(video);
    emit();
    void putOne<PersistedVideo>(VIDEO_STORE, {
      id,
      title: video.title,
      duration: video.duration,
      thumb: video.thumb,
      file: f,
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

export const shareItems = async (items: { title: string; src: string }[]) => {
  if (items.length === 0) return;
  const single = items.length === 1 ? items[0] : null;
  const title = single ? single.title : "ZabPlay";
  const text = items.map((i) => `${i.title}\n${i.src}`).join("\n\n");
  await nativeShare(title, text, single?.src);
};