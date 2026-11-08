// The one requestAnimationFrame loop for every continuous visual. It runs while the song plays,
// and keeps running while onFrame reports unfinished motion (easing after pause, seek or hover).
// wake() restarts it when idle; it can never stack a second loop.
export function driveFrames(audio: HTMLAudioElement, onFrame: (dtMs: number) => boolean) {
  let handle = 0;
  let last = 0;
  const tick = (now: number) => {
    const dt = last ? Math.min(100, now - last) : 1000 / 60; // capped so a background tab can't jump
    last = now;
    const busy = onFrame(dt);
    handle = !audio.paused || busy ? requestAnimationFrame(tick) : 0;
    if (!handle) last = 0;
  };
  const wake = () => {
    if (!handle) handle = requestAnimationFrame(tick);
  };
  for (const type of ['play', 'pause', 'ended', 'seeking', 'seeked', 'loadedmetadata']) audio.addEventListener(type, wake);
  wake();
  return { wake };
}
