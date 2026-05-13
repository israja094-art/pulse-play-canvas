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