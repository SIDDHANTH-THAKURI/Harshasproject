/** Small helpers shared across the app. */

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => (b === a ? 0 : (v - a) / (b - a));

/** Smooth 0..1 ramp between two edges. */
export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01(invLerp(edge0, edge1, x));
  return t * t * (3 - 2 * t);
}

export function mean(values: ArrayLike<number>): number {
  if (!values.length) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return sum / values.length;
}

export function maxOf(values: ArrayLike<number>): number {
  let m = -Infinity;
  for (let i = 0; i < values.length; i++) if (values[i] > m) m = values[i];
  return m === -Infinity ? 0 : m;
}

export function stdev(values: ArrayLike<number>): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let acc = 0;
  for (let i = 0; i < values.length; i++) acc += (values[i] - m) ** 2;
  return Math.sqrt(acc / (values.length - 1));
}

/** Average of a slice of a signal, tolerant of out-of-range indices. */
export function sliceMean(values: number[], from: number, to: number): number {
  const a = clamp(Math.floor(from), 0, values.length - 1);
  const b = clamp(Math.ceil(to), 0, values.length - 1);
  if (b <= a) return values[a] ?? 0;
  let sum = 0;
  for (let i = a; i <= b; i++) sum += values[i];
  return sum / (b - a + 1);
}

export function sliceMax(values: number[], from: number, to: number): number {
  const a = clamp(Math.floor(from), 0, values.length - 1);
  const b = clamp(Math.ceil(to), 0, values.length - 1);
  let m = -Infinity;
  for (let i = a; i <= b; i++) if (values[i] > m) m = values[i];
  return m === -Infinity ? 0 : m;
}

/** Deterministic PRNG so every edit is reproducible from its seed. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable hash of a string -> 32 bit int. Used to seed per-asset randomness. */
export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

let idCounter = 0;
export function uid(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, '0')}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0s';
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function titleCase(str: string): string {
  return str.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Yield to the browser so long loops don't freeze the UI.
 *
 * Uses a MessageChannel rather than setTimeout: background tabs clamp timers to ~1s,
 * which would otherwise turn a yielding analysis loop into a minute-long stall the
 * moment someone switches tab.
 */
export function nextTick(): Promise<void> {
  if (typeof MessageChannel === 'undefined') {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Nearest value in a sorted list (used for beat snapping). */
export function nearestIn(sorted: number[], value: number): number {
  if (!sorted.length) return value;
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  const a = sorted[Math.max(0, lo - 1)];
  const b = sorted[lo];
  return Math.abs(a - value) <= Math.abs(b - value) ? a : b;
}
