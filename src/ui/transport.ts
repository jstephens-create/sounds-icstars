// Temporary transport: play/pause, time readout, seek bar. Drives the native <audio> element only.
import { el } from './dom.ts';

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function createTransport(audio: HTMLAudioElement, beforeFirstPlay: () => Promise<void>) {
  const root = el('section', 'panel transport');
  root.setAttribute('aria-label', 'Soundtrack');
  const title = el('h2', 'label', 'SOUNDTRACK / LEVEL UP');
  const button = el('button', 'play', 'PLAY');
  button.type = 'button';
  const clock = el('span', 'clock', '00:00 / --:--');
  const seek = el('input', 'seek');
  seek.type = 'range';
  seek.min = '0';
  seek.step = '0.1';
  seek.value = '0';
  seek.disabled = true;
  seek.setAttribute('aria-label', 'Song position');
  const state = el('span', 'label state', 'IDLE');
  state.setAttribute('aria-live', 'polite');

  button.addEventListener('click', async () => {
    if (!audio.paused) return audio.pause();
    try {
      await beforeFirstPlay();
      await audio.play();
    } catch (err) {
      state.textContent = 'PLAYBACK FAILED';
      console.error(err);
    }
  });
  audio.addEventListener('error', () => {
    state.textContent = 'AUDIO FILE COULD NOT BE LOADED';
  });
  seek.addEventListener('input', () => {
    audio.currentTime = Number(seek.value);
  });

  // Called every animation frame: writes the DOM only when something visible changed (≤4×/s while playing).
  let shown = '';
  function update(): void {
    const d = audio.duration;
    const key = `${Math.floor(audio.currentTime * 4)}|${d}|${audio.paused}|${audio.ended}`;
    if (key === shown) return;
    shown = key;
    if (Number.isFinite(d)) {
      seek.max = String(d);
      seek.disabled = false;
    }
    seek.value = String(audio.currentTime);
    seek.setAttribute('aria-valuetext', `${formatTime(audio.currentTime)} of ${formatTime(d)}`);
    clock.textContent = `${formatTime(audio.currentTime)} / ${formatTime(d)}`;
    button.textContent = audio.paused ? 'PLAY' : 'PAUSE';
    state.textContent = audio.ended ? 'ENDED' : audio.paused ? (audio.currentTime > 0 ? 'PAUSED' : 'IDLE') : 'PLAYING';
  }

  root.append(title, el('div', 'controls'), seek, state);
  root.querySelector('.controls')?.append(button, clock);
  return { el: root, update };
}
