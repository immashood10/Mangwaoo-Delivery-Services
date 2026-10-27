// The sound that goes with a new notification (client-side only). It is a short two-note chime of about a second and a
// half, made with the Web Audio API, so there is no sound file to download and nothing is kept in the browser.
//
// Browsers only let a page make a sound after the visitor has tapped, clicked or pressed a key on it once. The first such
// gesture "unlocks" the sound (`enableNotificationSound` listens for it); until then a new notification is silent, while
// the bell and the pop-up still show it. After a reload the first tap unlocks it again.

type AudioContextConstructor = typeof AudioContext;

// Two notes (A5, then E6) that ring out softly.
const NOTES = [
  { frequency: 880, start: 0, duration: 0.9 },
  { frequency: 1318.51, start: 0.22, duration: 1.2 },
] as const;

/** How long the chime lasts, in seconds (the end of the last note). */
export const NOTIFICATION_SOUND_SECONDS = Math.max(...NOTES.map((note) => note.start + note.duration));

const VOLUME = 0.22;
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
// Several things can notice the same news at once (two bells on one page, three notifications in one poll): one chime is enough.
const MIN_GAP_MS = 1500;

let context: AudioContext | null = null;
let isUnlockBound = false;
let lastPlayedAt = 0;

function createContext() {
  const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;

  if (!Constructor) return null;

  try {
    return new Constructor();
  } catch {
    return null;
  }
}

/**
 * Asks to be unlocked by the visitor's first tap, click or key press (and again after the browser puts the sound to sleep,
 * which phones do when the page is in the background). Safe to call as often as you like.
 */
export function enableNotificationSound() {
  if (typeof window === 'undefined' || isUnlockBound) return;

  isUnlockBound = true;

  const unlock = () => {
    // Made inside the gesture, so the browser lets it run.
    context ??= createContext();

    if (context && context.state === 'suspended') void context.resume().catch(() => undefined);
  };

  for (const name of UNLOCK_EVENTS) window.addEventListener(name, unlock, { passive: true });
}

/** Plays the chime. Answers whether it did: false while locked (nobody has tapped the page yet) or right after another chime. */
export function playNotificationSound(now: number = Date.now()) {
  if (!context || context.state !== 'running') return false;
  if (now - lastPlayedAt < MIN_GAP_MS) return false;

  lastPlayedAt = now;

  try {
    const start = context.currentTime;
    const master = context.createGain();
    master.gain.value = VOLUME;
    master.connect(context.destination);

    for (const note of NOTES) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = note.frequency;
      // A quick fade in and a long fade out, so there are no clicks at the start or the end.
      envelope.gain.setValueAtTime(0.0001, start + note.start);
      envelope.gain.exponentialRampToValueAtTime(1, start + note.start + 0.02);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + note.start + note.duration);
      oscillator.connect(envelope).connect(master);
      oscillator.start(start + note.start);
      oscillator.stop(start + note.start + note.duration + 0.05);
    }

    return true;
  } catch {
    return false;
  }
}
