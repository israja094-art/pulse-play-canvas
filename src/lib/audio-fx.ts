import { getSharedAudio } from "./audio-player";

// Real Web Audio equalizer applied to the shared audio element.
// A MediaElementSource can only be created once per element, so everything
// is kept in module-scoped singletons.

let ctx: AudioContext | null = null;
let source: MediaElementAudioSourceNode | null = null;
let bassNode: BiquadFilterNode | null = null;
let midNode: BiquadFilterNode | null = null;
let trebleNode: BiquadFilterNode | null = null;

type FxState = { bass: number; mid: number; treble: number };
const LS_FX = "zabplay.fx.eq";

const loadState = (): FxState => {
  if (typeof window === "undefined") return { bass: 0, mid: 0, treble: 0 };
  try {
    return { bass: 0, mid: 0, treble: 0, ...JSON.parse(localStorage.getItem(LS_FX) || "{}") };
  } catch {
    return { bass: 0, mid: 0, treble: 0 };
  }
};

let fxState: FxState = loadState();

const ensureGraph = () => {
  if (typeof window === "undefined") return false;
  const audio = getSharedAudio();
  if (!audio) return false;

  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return false;

  if (!ctx) ctx = new AC();
  if (!source) {
    try {
      source = ctx.createMediaElementSource(audio);
    } catch {
      return false;
    }
    bassNode = ctx.createBiquadFilter();
    bassNode.type = "lowshelf";
    bassNode.frequency.value = 250;

    midNode = ctx.createBiquadFilter();
    midNode.type = "peaking";
    midNode.frequency.value = 1000;
    midNode.Q.value = 1;

    trebleNode = ctx.createBiquadFilter();
    trebleNode.type = "highshelf";
    trebleNode.frequency.value = 4000;

    source.connect(bassNode);
    bassNode.connect(midNode);
    midNode.connect(trebleNode);
    trebleNode.connect(ctx.destination);

    // apply persisted gains
    bassNode.gain.value = fxState.bass;
    midNode.gain.value = fxState.mid;
    trebleNode.gain.value = fxState.treble;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return true;
};

const persist = () => {
  if (typeof window !== "undefined") localStorage.setItem(LS_FX, JSON.stringify(fxState));
};

export const getEqState = (): FxState => ({ ...fxState });

export const setBass = (v: number) => {
  fxState.bass = v;
  if (ensureGraph() && bassNode) bassNode.gain.value = v;
  persist();
};

export const setMid = (v: number) => {
  fxState.mid = v;
  if (ensureGraph() && midNode) midNode.gain.value = v;
  persist();
};

export const setTreble = (v: number) => {
  fxState.treble = v;
  if (ensureGraph() && trebleNode) trebleNode.gain.value = v;
  persist();
};

export const resetEq = () => {
  fxState = { bass: 0, mid: 0, treble: 0 };
  if (ensureGraph()) {
    if (bassNode) bassNode.gain.value = 0;
    if (midNode) midNode.gain.value = 0;
    if (trebleNode) trebleNode.gain.value = 0;
  }
  persist();
};
