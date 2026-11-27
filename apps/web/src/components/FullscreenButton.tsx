import { useEffect, useState } from 'react';
import { inTvApp } from '../lib/audio';

// Safari on iPad still only has the prefixed versions.
type WebkitDocument = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => void };

const doc = document as WebkitDocument;
const isFull = () => !!(document.fullscreenElement ?? doc.webkitFullscreenElement);

/** Hides the browser's bars. Not shown where it can't work: iPhones (Add to Home Screen does it there) and the Fire TV app. */
export function FullscreenButton({ className = '' }: { className?: string }) {
  const [full, setFull] = useState(isFull);
  useEffect(() => {
    const update = () => setFull(isFull());
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('webkitfullscreenchange', update);
    return () => {
      document.removeEventListener('fullscreenchange', update);
      document.removeEventListener('webkitfullscreenchange', update);
    };
  }, []);

  if (inTvApp || !(document.fullscreenEnabled || doc.webkitFullscreenEnabled)) return null;

  const toggle = () => {
    if (isFull()) {
      if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
      else doc.webkitExitFullscreen?.();
      return;
    }
    const root = document.documentElement as WebkitElement;
    if (root.requestFullscreen) void root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    else root.webkitRequestFullscreen?.();
  };

  return (
    <button
      onClick={toggle}
      aria-label={full ? 'Exit full screen' : 'Full screen'}
      title={full ? 'Exit full screen' : 'Full screen'}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-night-700 text-mist transition hover:text-ink ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {full ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
      </svg>
    </button>
  );
}
