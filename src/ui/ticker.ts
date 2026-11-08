// Continuous kinetic typography band: two rows crossing in opposite directions at different speeds.
// Runs on the compositor via the Web Animations API (no per-frame JavaScript). Each row holds its
// content twice and travels exactly one copy's width, so the loop point is invisible.
// setRate(0) holds it still; other rates change speed without a jump (updatePlaybackRate keeps position).
// Decorative (aria-hidden): every name and phrase here is also on the page as text.
import type { Member } from '../members/validate.ts';
import { el } from './dom.ts';

const PHRASES = ['LEVEL UP / 060', 'IC STARS / CYCLE 60', 'IDENTITY / TECHNOLOGY / COLLECTIVE', 'LEARN / BUILD / EVOLVE'];

export function createTicker(members: Member[]) {
  const root = el('div', 'ticker');
  root.setAttribute('aria-hidden', 'true');

  const row = (className: string, items: string[], repeat: number, seconds: number, reverse: boolean) => {
    const track = el('div', `ticker-track ${className}`);
    const copy = () => {
      const half = el('div', 'ticker-copy');
      for (let r = 0; r < repeat; r++) for (const text of items) half.append(el('span', 'ticker-item', text));
      return half;
    };
    track.append(copy(), copy());
    const line = el('div', 'ticker-row');
    line.append(track);
    root.append(line);
    const frames = [{ transform: 'translateX(0)' }, { transform: 'translateX(-50%)' }];
    return track.animate(reverse ? [...frames].reverse() : frames, { duration: seconds * 1000, iterations: Infinity, easing: 'linear' });
  };

  const anims = [
    row('phrases', PHRASES, 3, 110, true),
    row('roster', members.map((m) => `${m.id} ${m.name.toUpperCase()}`), 1, 70, false),
  ];

  let rate = 1;
  return {
    el: root,
    setRate(next: number): void {
      if (next === rate) return;
      rate = next;
      for (const a of anims) {
        if (next === 0) a.pause();
        else {
          a.play();
          a.updatePlaybackRate(next);
        }
      }
    },
  };
}
