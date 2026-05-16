export type Video = {
  id: string;
  title: string;
  duration: string;
  thumb: string;
  src: string;
};

export type Song = {
  id: string;
  title: string;
  artist: string;
  cover: string;
  duration: string;
  src: string;
};

export const videos: Video[] = [];

export const songs: Song[] = [];

export const formatTime = (sec: number) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};
