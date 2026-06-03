import { useEffect, useState } from "react";
import { Sheet } from "./SongActionMenu";
import { getEqState, setBass, setMid, setTreble, resetEq } from "@/lib/audio-fx";
import {
  setSleepTimer,
  cancelSleepTimer,
  getSleepEndsAt,
  onSleepChange,
} from "@/lib/audio-player";

export function EqualizerSheet({ onClose }: { onClose: () => void }) {
  const [eq, setEq] = useState(getEqState());

  const band = (label: string, value: number, apply: (v: number) => void) => (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="text-primary">{value > 0 ? `+${value}` : value} dB</span>
      </div>
      <input
        type="range"
        min={-12}
        max={12}
        step={1}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          apply(v);
          setEq(getEqState());
        }}
        className="w-full accent-[color:var(--primary)]"
      />
    </div>
  );

  return (
    <Sheet onClose={onClose}>
      <p className="px-2 pb-4 text-base font-semibold text-foreground">Equalizer</p>
      <div className="space-y-4 px-2">
        {band("Bass", eq.bass, setBass)}
        {band("Mid", eq.mid, setMid)}
        {band("Treble", eq.treble, setTreble)}
      </div>
      <div className="mt-5 flex gap-2 px-2">
        <button
          onClick={() => {
            resetEq();
            setEq(getEqState());
          }}
          className="flex-1 rounded-xl bg-secondary py-3 text-sm font-medium text-foreground"
        >
          Reset
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
        >
          Done
        </button>
      </div>
    </Sheet>
  );
}

export function SleepTimerSheet({ onClose }: { onClose: () => void }) {
  const [endsAt, setEndsAt] = useState<number | null>(getSleepEndsAt());

  useEffect(() => {
    const off = onSleepChange(() => setEndsAt(getSleepEndsAt()));
    return () => {
      off();
    };
  }, []);

  const options = [5, 10, 15, 30, 45, 60];
  const remaining = endsAt ? Math.max(0, Math.round((endsAt - Date.now()) / 60000)) : 0;

  return (
    <Sheet onClose={onClose}>
      <p className="px-2 pb-2 text-base font-semibold text-foreground">Sleep timer</p>
      {endsAt ? (
        <p className="px-2 pb-3 text-xs text-primary">Music stops in ~{remaining} min</p>
      ) : (
        <p className="px-2 pb-3 text-xs text-muted-foreground">Auto-stop music after</p>
      )}
      <div className="grid grid-cols-3 gap-2 px-2">
        {options.map((m) => (
          <button
            key={m}
            onClick={() => {
              setSleepTimer(m);
              onClose();
            }}
            className="rounded-xl bg-secondary py-3 text-sm font-medium text-foreground active:bg-primary active:text-primary-foreground"
          >
            {m} min
          </button>
        ))}
      </div>
      <button
        onClick={() => {
          cancelSleepTimer();
          onClose();
        }}
        className="mt-4 w-full rounded-xl bg-secondary py-3 text-sm font-medium text-destructive"
      >
        Turn off timer
      </button>
    </Sheet>
  );
}
