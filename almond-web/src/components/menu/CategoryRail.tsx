'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

type RailItem = { id: string; name: string };

/** Sticky category chips. Scrolls to a section on click; highlights the one in view. */
export function CategoryRail({ items }: { items: RailItem[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.replace('cat-', ''));
      },
      { rootMargin: '-128px 0px -70% 0px', threshold: 0 },
    );
    items.forEach((it) => {
      const el = document.getElementById(`cat-${it.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  const go = (id: string) => {
    const el = document.getElementById(`cat-${id}`);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 112;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  return (
    <div className="no-scrollbar sticky top-16 z-30 -mx-5 flex gap-2 overflow-x-auto border-b border-neutral-warm bg-background/95 px-5 py-3 backdrop-blur md:-mx-8 md:px-8">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => go(it.id)}
          className={cn(
            'shrink-0 rounded-pill px-4 py-1.5 text-sm font-bold transition-colors',
            active === it.id
              ? 'bg-primary text-white'
              : 'bg-neutral-warm text-text-primary hover:bg-accent-light',
          )}
        >
          {it.name}
        </button>
      ))}
    </div>
  );
}
