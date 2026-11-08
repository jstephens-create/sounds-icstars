// Audio analysis layer (Web Audio API). Knows nothing about members, timeline or selection.
// Visual components read one AudioFrame per animation frame via sample().

export interface AudioFrame {
  energy: number; // overall loudness 0..1, normalized against recent peaks
  low: number; // ~20–250 Hz, 0..1
  mid: number; // ~250 Hz–2 kHz, 0..1
  high: number; // ~2–12 kHz, 0..1
  spectrum: Float32Array; // every FFT bin, 0..1 (fast attack, timed release)
  wave: Float32Array; // raw time-domain samples, -1..1
  binHz: number; // frequency width of one spectrum bin
}

export const SILENT: AudioFrame = {
  energy: 0, low: 0, mid: 0, high: 0, spectrum: new Float32Array(0), wave: new Float32Array(0), binHz: 1,
};

/** Envelope follower: jumps up to a rise instantly, decays toward a fall with time constant tauMs. Frame-rate independent. */
export function follow(current: number, target: number, dtMs: number, tauMs: number): number {
  return target >= current ? target : target + (current - target) * Math.exp(-dtMs / tauMs);
}

/** Average of spectrum bins (0..1) between two frequencies. */
export function bandAverage(spectrum: ArrayLike<number>, binHz: number, loHz: number, hiHz: number): number {
  const lo = Math.max(0, Math.floor(loHz / binHz));
  const hi = Math.min(spectrum.length - 1, Math.ceil(hiHz / binHz));
  if (hi < lo) return 0;
  let sum = 0;
  for (let i = lo; i <= hi; i++) sum += spectrum[i] ?? 0;
  return sum / (hi - lo + 1);
}

/** n log-spaced bands between fMin and fMax, each 0..1, written into out (reused every frame). */
export function logBands(
  spectrum: ArrayLike<number>, binHz: number, n: number, fMin = 30, fMax = 16000, out = new Float32Array(n),
): Float32Array {
  const ratio = fMax / fMin;
  for (let i = 0; i < n; i++) out[i] = bandAverage(spectrum, binHz, fMin * ratio ** (i / n), fMin * ratio ** ((i + 1) / n));
  return out;
}

/** Root-mean-square level of time-domain samples (-1..1). */
export function rms(samples: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += (samples[i] ?? 0) ** 2;
  return samples.length ? Math.sqrt(sum / samples.length) : 0;
}

/** Scales a level to 0..1 against a slowly decaying running peak, so quiet and loud songs both use the full range. */
export function createNormalizer(decay = 0.995, floor = 0.02) {
  let peak = floor;
  return (level: number): number => {
    peak = Math.max(level, peak * decay, floor);
    return Math.min(1, level / peak);
  };
}

/** releaseMs: how fast levels fall after a hit (read every frame, so reduced motion can lengthen it live). */
export function createAnalyser(audio: HTMLAudioElement, releaseMs: () => number) {
  let ctx: AudioContext | null = null;
  let node: AnalyserNode | null = null;
  let bytes = new Uint8Array(0);
  let wave = new Float32Array(0);
  let spectrum = new Float32Array(0);
  const normalize = createNormalizer();
  let energy = 0;
  let frames = 0;
  let peakBin = 0;

  return {
    /** For developer diagnostics: proves the analyser is receiving signal. */
    status() {
      return { state: ctx?.state ?? 'not started', sampleRate: ctx?.sampleRate ?? 0, frames, peakBin };
    },

    /** Must be called from a user gesture (browsers block audio contexts until then). Safe to call repeatedly. */
    async start(): Promise<void> {
      if (!ctx) {
        ctx = new AudioContext();
        node = ctx.createAnalyser();
        node.fftSize = 2048; // ~43 ms window: 23 Hz bins resolve the bass without smearing onsets
        // The browser default (0.8) smooths rises and falls alike: measured >600 ms to release.
        // Off here; sample() applies an envelope instead: instant attack, timed release.
        node.smoothingTimeConstant = 0;
        ctx.createMediaElementSource(audio).connect(node); // allowed once per element
        node.connect(ctx.destination);
        bytes = new Uint8Array(node.frequencyBinCount);
        wave = new Float32Array(node.fftSize);
        spectrum = new Float32Array(node.frequencyBinCount);
      }
      await ctx.resume();
    },

    /** dtMs: time since the previous sample (from the animation loop). Reuses the same arrays every call. */
    sample(dtMs: number): AudioFrame {
      if (!ctx || !node) return SILENT;
      node.getByteFrequencyData(bytes);
      node.getFloatTimeDomainData(wave);
      frames++;
      peakBin = 0;
      const tau = releaseMs();
      for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i] ?? 0;
        spectrum[i] = follow(spectrum[i] ?? 0, b / 255, dtMs, tau);
        if (b > peakBin) peakBin = b;
      }
      energy = follow(energy, normalize(rms(wave)), dtMs, tau);
      const binHz = ctx.sampleRate / node.fftSize;
      return {
        energy,
        low: bandAverage(spectrum, binHz, 20, 250),
        mid: bandAverage(spectrum, binHz, 250, 2000),
        high: bandAverage(spectrum, binHz, 2000, 12000),
        spectrum,
        wave,
        binHz,
      };
    },
  };
}
