type AudioSong = {
  id: string;
  src: string;
};

let sharedAudio: HTMLAudioElement | null = null;
let activeSongId: string | null = null;

const normalizeSrc = (src: string) => {
  if (typeof window === "undefined") return src;
  return new URL(src, window.location.href).href;
};

export const getSharedAudio = () => {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "metadata";
    sharedAudio.crossOrigin = "anonymous";
    sharedAudio.setAttribute("playsinline", "true");
  }
  return sharedAudio;
};

export const syncSongSource = (song: AudioSong) => {
  const audio = getSharedAudio();
  if (!audio) return null;

  const nextSrc = normalizeSrc(song.src);
  const currentSrc = audio.currentSrc || audio.src;
  const changed = activeSongId !== song.id || currentSrc !== nextSrc;

  if (changed) {
    audio.pause();
    audio.src = song.src;
    audio.load();
    activeSongId = song.id;
  }

  return audio;
};

export const playSongNow = (song: AudioSong) => {
  const audio = syncSongSource(song);
  audio?.play().catch(() => {});
  return audio;
};

export const getActiveSongId = () => activeSongId;

// ===== Sleep timer (auto-stop playback) =====
let sleepTimer: ReturnType<typeof setTimeout> | null = null;
let sleepEndsAt: number | null = null;
const sleepListeners = new Set<() => void>();

const emitSleep = () => sleepListeners.forEach((l) => l());

export const onSleepChange = (l: () => void) => {
  sleepListeners.add(l);
  return () => sleepListeners.delete(l);
};

export const cancelSleepTimer = () => {
  if (sleepTimer) clearTimeout(sleepTimer);
  sleepTimer = null;
  sleepEndsAt = null;
  emitSleep();
};

export const setSleepTimer = (minutes: number) => {
  if (sleepTimer) clearTimeout(sleepTimer);
  if (!minutes || minutes <= 0) {
    cancelSleepTimer();
    return;
  }
  sleepEndsAt = Date.now() + minutes * 60000;
  sleepTimer = setTimeout(() => {
    getSharedAudio()?.pause();
    sleepTimer = null;
    sleepEndsAt = null;
    emitSleep();
  }, minutes * 60000);
  emitSleep();
};

export const getSleepEndsAt = () => sleepEndsAt;
