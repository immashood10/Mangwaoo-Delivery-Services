'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Link2, MessageCircle, Send, Share2 } from 'lucide-react';

const OPTION_CLASS =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-brand-light';

/** Share menu: copy the link, WhatsApp, Telegram, and the device's own share sheet when there is one. */
export default function ShareButton({
  path,
  title,
  text,
  label = 'Share',
}: {
  /** Site-relative path to share, e.g. /mart/abc123 — the origin is added in the browser. */
  path: string;
  title: string;
  text?: string;
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canShareNatively, setCanShareNatively] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') setIsOpen(false);
      } else if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [isOpen]);

  const getUrl = () => `${window.location.origin}${path}`;
  const message = () => `${text ? `${text}\n` : title ? `${title}\n` : ''}${getUrl()}`;

  const handleCopy = async () => {
    const url = getUrl();

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard is blocked on some pages/browsers — fall back to a temporary text box.
      const box = document.createElement('textarea');
      box.value = url;
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      document.execCommand('copy');
      box.remove();
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const openExternal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  const handleNativeShare = async () => {
    setIsOpen(false);

    try {
      await navigator.share({ title, text: text ?? title, url: getUrl() });
    } catch {
      // Closing the share sheet rejects with AbortError — nothing to do.
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          // Checked here (not on render) so server and browser markup always match.
          setCanShareNatively(typeof navigator.share === 'function');
          setIsOpen((open) => !open);
        }}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
      >
        <Share2 className="h-4 w-4" />
        {label}
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-56 rounded-2xl border border-gray-100 bg-surface p-1.5 shadow-lg"
        >
          <button type="button" role="menuitem" onClick={handleCopy} className={OPTION_CLASS}>
            {copied ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4 text-accent" />}
            {copied ? 'Link copied!' : 'Copy link'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => openExternal(`https://wa.me/?text=${encodeURIComponent(message())}`)}
            className={OPTION_CLASS}
          >
            <MessageCircle className="h-4 w-4 text-accent" />
            WhatsApp
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() =>
              openExternal(
                `https://t.me/share/url?url=${encodeURIComponent(getUrl())}&text=${encodeURIComponent(text ?? title)}`
              )
            }
            className={OPTION_CLASS}
          >
            <Send className="h-4 w-4 text-accent" />
            Telegram
          </button>
          {canShareNatively ? (
            <button type="button" role="menuitem" onClick={handleNativeShare} className={OPTION_CLASS}>
              <Share2 className="h-4 w-4 text-accent" />
              More options…
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
