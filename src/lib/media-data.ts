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
  src: string;
};

export const videos: Video[] = [
  {
    id: "nature-4k",
    title: "Beautiful Nature in 4K",
    duration: "10:32",
    thumb: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=240&fit=crop",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  },
  {
    id: "waterfall",
    title: "Waterfall – The Sound of Nature",
    duration: "08:47",
    thumb: "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=400&h=240&fit=crop",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  },
  {
    id: "cities-night",
    title: "Top 10 Beautiful Cities at Night",
    duration: "11:15",
    thumb: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=400&h=240&fit=crop",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
  {
    id: "maldives",
    title: "Maldives – Paradise on Earth",
    duration: "09:18",
    thumb: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=400&h=240&fit=crop",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  },
  {
    id: "ocean-waves",
    title: "Ocean Waves – Peaceful Mind",
    duration: "08:35",
    thumb: "https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=400&h=240&fit=crop",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  },
  {
    id: "deep-forest",
    title: "Deep Forest – Relaxing Nature",
    duration: "12:05",
    thumb: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&h=240&fit=crop",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  },
  {
    id: "switzerland",
    title: "Switzerland 4K – Heaven on Earth",
    duration: "11:45",
    thumb: "https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=400&h=240&fit=crop",
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  },
];

export const songs: Song[] = [
  {
    id: "dreams",
    title: "Dreams",
    artist: "Alan Walker",
    cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    id: "on-and-on",
    title: "On & On",
    artist: "Cartoon, Daniel Levi",
    cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    id: "faded",
    title: "Faded",
    artist: "Alan Walker",
    cover: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=200&h=200&fit=crop",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  },
  {
    id: "alone",
    title: "Alone",
    artist: "Marshmello",
    cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  },
  {
    id: "spectre",
    title: "Spectre",
    artist: "Alan Walker",
    cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
  },
  {
    id: "horizon",
    title: "Horizon",
    artist: "NCS",
    cover: "https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=200&h=200&fit=crop",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
  },
  {
    id: "love-me",
    title: "Love Me Like You Do",
    artist: "Ellie Goulding",
    cover: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=200&h=200&fit=crop",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
  },
  {
    id: "sky-high",
    title: "Sky High",
    artist: "Elektronomia",
    cover: "https://images.unsplash.com/photo-1496293455970-f8581aae0e3b?w=200&h=200&fit=crop",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  },
  {
    id: "heroes-tonight",
    title: "Heroes Tonight",
    artist: "Janji",
    cover: "https://images.unsplash.com/photo-1504672281656-e4981d70414b?w=200&h=200&fit=crop",
    src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
  },
];

export const formatTime = (sec: number) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};
