// Member index: the accessible, keyboard-operable list of all 16 identities. The network canvas
// (System 01) is a visual layer over the same actions.
// Hover or focus previews a member; click / Enter / Space opens their profile.
import { SECTIONS } from '../members/parse.ts';
import { completedSections, type Member } from '../members/validate.ts';
import { GROUP, type Who } from '../timeline/timeline.ts';
import { el } from './dom.ts';

export function createIndex(members: Member[], on: { hover: (slug: string | null) => void; select: (slug: string) => void }) {
  const section = el('section', 'panel index');
  section.setAttribute('aria-labelledby', 'index-title');
  const title = el('h2', 'label', `MEMBER INDEX / ${members.length}`);
  title.id = 'index-title';

  const list = el('ol', 'member-index');
  const items = members.map((m) => {
    const item = el('li');
    item.dataset.slug = m.slug;
    const button = el('button', 'member-btn');
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    const total = SECTIONS.length;
    button.title = `${completedSections(m)} of ${total} profile sections complete`;
    button.append(
      el('span', 'id', m.id),
      el('span', 'name', m.name),
      el('span', 'status', `${completedSections(m)}/${total}`),
    );
    button.addEventListener('pointerenter', () => on.hover(m.slug));
    button.addEventListener('pointerleave', () => on.hover(null));
    button.addEventListener('focus', () => on.hover(m.slug));
    button.addEventListener('blur', () => on.hover(null));
    button.addEventListener('click', () => on.select(m.slug));
    item.append(button, el('span', 'marker'));
    list.append(item);
    return { item, button, slug: m.slug };
  });
  section.append(title, list);

  let current: Who | undefined;
  return {
    el: section,
    /** Who the soundtrack mentions now (a member, GROUP, or null). */
    setFocus(who: Who): void {
      if (who === current) return;
      current = who;
      list.classList.toggle('focus-group', who === GROUP);
      for (const { item, slug } of items) {
        const on = slug === who;
        item.classList.toggle('is-mentioned', on);
        if (on) item.setAttribute('aria-current', 'true');
        else item.removeAttribute('aria-current');
      }
    },
    setSelected(slug: string | null): void {
      for (const { item, button, slug: s } of items) {
        item.classList.toggle('is-selected', s === slug);
        button.setAttribute('aria-pressed', String(s === slug));
      }
    },
  };
}
