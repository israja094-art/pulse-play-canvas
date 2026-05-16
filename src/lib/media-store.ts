import { useSyncExternalStore } from "react";
import { videos as defaultVideos, songs as defaultSongs, type Video, type Song } from "./media-data";

type State = {
  videos: Video[];
  songs: Song[];
};

const LS_DELETED_V = "zabplay.deleted.videos";
const LS_DELETED_S = "zabplay.deleted.songs";

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

const userVideos: Video[] = [];
const userSongs: Song[] = [];
const VIDEO_THUMB_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" rx="18" fill="#111827"/><circle cx="160" cy="90" r="32" fill="#ffffff22"/><path d="M148 70v40l30-20-30-20z" fill="#f8fafc"/></svg>`);
const SONG_COVER_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><rect width="300" height="300" rx="28" fill="#111827"/><circle cx="150" cy="150" r="82" fill="#ffffff14"/><circle cx="150" cy="150" r="22" fill="#f8fafc"/><path d="M178 84v90.5a25 25 0 1 1-14-22.5V108l58-11v63.5a25 25 0 1 1-14-22.5V84z" fill="#cbd5e1"/></svg>`);

const computeState = (): State => ({
  videos: [...userVideos, ...defaultVideos.filter((v) => !deletedV.has(v.id))],
  songs: [...userSongs, ...defaultSongs.filter((s) => !deletedS.has(s.id))],
});

let state: State = computeState();
const listeners = new Set<() => void>();
const emit = () => {
  state = computeState();
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  if (!hydratedFromStorage && typeof window !== "undefined") {
    hydratedFromStorage = true;
    deletedV = loadDeleted(LS_DELETED_V);
    deletedS = loadDeleted(LS_DELETED_S);
    queueMicrotask(() => emit());
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
    const i = userVideos.findIndex((v) => v.id === id);
    if (i >= 0) {
      URL.revokeObjectURL(userVideos[i].src);
      userVideos.splice(i, 1);
    } else {
      deletedV.add(id);
    }
  }
  saveDeleted(LS_DELETED_V, deletedV);
  emit();
};

export const deleteSongs = (ids: string[]) => {
  for (const id of ids) {
    const i = userSongs.findIndex((s) => s.id === id);
    if (i >= 0) {
      URL.revokeObjectURL(userSongs[i].src);
      userSongs.splice(i, 1);
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
    const url = URL.createObjectURL(f);
    const { duration, thumb } = await probeVideo(url);
    userVideos.unshift({
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: f.name.replace(/\.[^.]+$/, ""),
      duration,
      thumb: thumb || VIDEO_THUMB_PLACEHOLDER,
      src: url,
    });
    emit();
  }
};

export const importAudioFiles = async (files: FileList | File[]) => {
  const arr = Array.from(files);
  for (const f of arr) {
    const url = URL.createObjectURL(f);
    const duration = await probeAudioDuration(url);
    userSongs.unshift({
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: f.name.replace(/\.[^.]+$/, ""),
      artist: duration,
      cover: SONG_COVER_PLACEHOLDER,
      src: url,
    });
    emit();
  }
};

export const shareItems = async (items: { title: string; src: string }[]) => {
  if (items.length === 0) return;
  const text = items.map((i) => `${i.title}\n${i.src}`).join("\n\n");
  const navAny = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (navAny.share) {
    try {
      await navAny.share({ title: "ZabPlay", text });
      return;
    } catch {
      /* fallback */
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    alert("Copied to clipboard");
  } catch {
    alert(text);
  }
};
