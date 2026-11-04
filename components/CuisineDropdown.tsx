'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, LayoutGrid, UtensilsCrossed } from 'lucide-react';

export type CuisineOption = { key: string; label: string; icon: string | null; href: string; active: boolean };

/**
 * "Cuisines for you": on a phone the food categories are one dropdown (a button that opens the list: All, Fast Food, Biryani,
 * Sweets…, each with its picture) instead of a long list of filters above the dishes. Choosing one opens the page for it, so
 * the server renders that category's dishes. The desktop page keeps its side list.
 */
export default function CuisineDropdown({ options, title = 'Cuisines for you' }: { options: CuisineOption[]; title?: string }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.active && option.key !== 'all');

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative" data-testid="cuisine-dropdown">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-surface px-4 py-3 text-left shadow-soft"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
            {current?.icon ? <span aria-hidden="true" className="text-lg leading-none">{current.icon}</span> : <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink">{title}</span>
            <span className="block truncate text-xs text-brand-gray">{current ? current.label : 'All dishes'}</span>
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-brand-gray transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open ? (
        <ul
          data-testid="cuisine-dropdown-list"
          className="absolute left-0 right-0 z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-gray-200 bg-surface p-2 shadow-lg"
        >
          {options.map((option) => (
            <li key={option.key}>
              <Link
                href={option.href}
                onClick={() => setOpen(false)}
                aria-current={option.active ? 'true' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  option.active ? 'bg-brand-red-primary/10 text-accent' : 'text-ink hover:bg-brand-light'
                }`}
              >
                <span className="flex w-6 shrink-0 items-center justify-center text-lg leading-none" aria-hidden="true">
                  {option.icon ?? <LayoutGrid className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.active ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
