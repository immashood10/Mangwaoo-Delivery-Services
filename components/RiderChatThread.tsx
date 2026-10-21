'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, MapPin, Mic, Navigation, Send, Trash2 } from 'lucide-react';
import {
  MAX_CHAT_IMAGE_BYTES,
  MAX_CHAT_VOICE_BYTES,
  MAX_CHAT_VOICE_SECONDS,
  MAX_RIDER_CHAT_MESSAGE_LENGTH,
  type RiderChatMessage,
  type RiderChatSender,
  type RiderChatSummary,
} from '@/lib/rider-chat-types';
import { compressImage } from '@/lib/client-image';

// Used only if the live stream can't connect (e.g. a proxy that blocks SSE).
const FALLBACK_POLL_MS = 3000;
const VOICE_MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

type ThreadMessage = RiderChatMessage & { pending?: boolean };

function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function googleDirectionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function MessageContent({
  message,
  isOwn,
  currentRole,
  onMediaLoad,
}: {
  message: ThreadMessage;
  isOwn: boolean;
  currentRole: RiderChatSender;
  onMediaLoad: () => void;
}) {
  const linkClass = isOwn ? 'text-white underline' : 'text-accent hover:underline';

  if (message.type === 'IMAGE' && message.attachmentUrl) {
    return (
      <>
        <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked chat attachment */}
          <img
            src={message.attachmentUrl}
            alt={message.body || `Photo from ${message.senderName}`}
            loading="lazy"
            onLoad={onMediaLoad}
            className={`max-h-64 w-56 max-w-full rounded-xl bg-black/5 object-cover ${message.pending ? 'opacity-70' : ''}`}
          />
        </a>
        {message.body ? <p className="mt-1 whitespace-pre-wrap break-words">{message.body}</p> : null}
      </>
    );
  }

  if (message.type === 'VOICE' && message.attachmentUrl) {
    return (
      <div className="flex items-center gap-2">
        <audio controls preload="metadata" src={message.attachmentUrl} className="h-10 w-56 max-w-full" />
        {message.durationSec ? <span className="shrink-0 text-xs opacity-80">{formatDuration(message.durationSec)}</span> : null}
      </div>
    );
  }

  if (message.type === 'LOCATION' && message.lat !== null && message.lng !== null) {
    return (
      <>
        <a
          href={googleMapsUrl(message.lat, message.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-xl bg-surface"
          aria-label="Open shared location in Google Maps"
        >
          <iframe
            title="Shared location"
            src={`https://maps.google.com/maps?q=${message.lat},${message.lng}&z=16&hl=en&output=embed`}
            className="pointer-events-none h-36 w-56 max-w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </a>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {isOwn ? 'You shared your location' : `${message.senderName} shared a location`}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs font-semibold">
          <a href={googleMapsUrl(message.lat, message.lng)} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Open in Google Maps
          </a>
          {currentRole === 'RIDER' && !isOwn ? (
            <a
              href={googleDirectionsUrl(message.lat, message.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 ${linkClass}`}
            >
              <Navigation className="h-3 w-3" />
              Directions
            </a>
          ) : null}
        </div>
      </>
    );
  }

  return <p className="whitespace-pre-wrap break-words">{message.body}</p>;
}

export default function RiderChatThread({
  chatId,
  currentRole,
  onChatUpdate,
  onMissing,
  placeholder = 'Type a message…',
  emptyText = 'No messages yet.',
}: {
  chatId: string;
  currentRole: RiderChatSender;
  onChatUpdate?: (chat: RiderChatSummary) => void;
  /** Called when the chat no longer exists (e.g. an admin deleted it). */
  onMissing?: () => void;
  placeholder?: string;
  emptyText?: string;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [chatStatus, setChatStatus] = useState<RiderChatSummary['status']>('OPEN');
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number | null>(null);
  const [error, setError] = useState('');

  const messagesRef = useRef<ThreadMessage[]>([]);
  const onChatUpdateRef = useRef(onChatUpdate);
  const onMissingRef = useRef(onMissing);
  const scrollRef = useRef<HTMLDivElement>(null);
  // True while the reader is at (or near) the bottom; new content only auto-scrolls then.
  const stickToBottomRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
  const discardRecordingRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    onChatUpdateRef.current = onChatUpdate;
    onMissingRef.current = onMissing;
  }, [onChatUpdate, onMissing]);

  const mergeMessages = (incoming: RiderChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const byId = new Map(prev.map((message) => [message.id, message]));
      for (const message of incoming) byId.set(message.id, message);
      return [...byId.values()].sort((a, b) => {
        if (a.pending !== b.pending) return a.pending ? 1 : -1;
        return a.createdAt.localeCompare(b.createdAt);
      });
    });
  };

  const applyChat = (chat: RiderChatSummary) => {
    setChatStatus(chat.status);
    onChatUpdateRef.current?.(chat);
  };

  // Initial load, then a live Server-Sent Events stream (falls back to polling).
  useEffect(() => {
    // Parents render this with key={chatId}, so switching chats remounts with fresh state.
    let cancelled = false;
    let source: EventSource | null = null;
    let pollTimer: number | null = null;

    const lastServerTimestamp = () =>
      [...messagesRef.current].reverse().find((message) => !message.pending)?.createdAt;

    const handleMissing = () => {
      if (onMissingRef.current) onMissingRef.current();
      else setError('This chat is no longer available.');
    };

    const fetchMessages = async (since?: string) => {
      try {
        const response = await fetch(
          `/api/rider-chats/${chatId}/messages${since ? `?since=${encodeURIComponent(since)}` : ''}`
        );
        const data = await response.json().catch(() => null);
        if (cancelled) return false;

        if (response.status === 404) {
          handleMissing();
          return false;
        }

        if (!response.ok) {
          setError(data?.error ?? 'Could not load this chat.');
          return false;
        }

        if (data.chat) applyChat(data.chat);
        mergeMessages(data.messages ?? []);
        return true;
      } catch {
        return false;
      }
    };

    const startPolling = () => {
      if (pollTimer !== null) return;
      pollTimer = window.setInterval(async () => {
        const ok = await fetchMessages(lastServerTimestamp());
        if (!ok && pollTimer !== null && messagesRef.current.length === 0) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
      }, FALLBACK_POLL_MS);
    };

    const openStream = () => {
      const since = lastServerTimestamp();
      source = new EventSource(`/api/rider-chats/${chatId}/stream${since ? `?since=${encodeURIComponent(since)}` : ''}`);

      source.addEventListener('messages', (event) => mergeMessages(JSON.parse((event as MessageEvent).data)));
      source.addEventListener('chat', (event) => applyChat(JSON.parse((event as MessageEvent).data)));
      source.addEventListener('missing', () => {
        source?.close();
        handleMissing();
      });
      source.addEventListener('forbidden', (event) => {
        source?.close();
        setError(JSON.parse((event as MessageEvent).data).error);
      });
      source.onerror = () => {
        // CONNECTING = EventSource is retrying by itself; CLOSED = the server refused.
        if (source?.readyState === EventSource.CLOSED && !cancelled) {
          fetchMessages(lastServerTimestamp()).then((ok) => {
            if (ok && !cancelled) startPolling();
          });
        }
      };
    };

    (async () => {
      const ok = await fetchMessages();
      if (cancelled) return;
      setIsLoading(false);
      if (ok) {
        if (typeof EventSource === 'undefined') startPolling();
        else openStream();
      }
    })();

    return () => {
      cancelled = true;
      source?.close();
      if (pollTimer !== null) window.clearInterval(pollTimer);
    };
  }, [chatId]);

  // Stop the mic if the thread unmounts mid-recording.
  useEffect(() => {
    return () => {
      discardRecordingRef.current = true;
      if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    };
  }, []);

  // Scroll only the message list — scrollIntoView would also scroll the whole page.
  const scrollToBottom = (behavior: ScrollBehavior) => {
    const list = scrollRef.current;
    if (list && stickToBottomRef.current) list.scrollTo({ top: list.scrollHeight, behavior });
  };

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages]);

  const handleListScroll = () => {
    const list = scrollRef.current;
    if (list) stickToBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  };

  /** Shows a message immediately, then swaps in the server's copy (or rolls back on failure). */
  const sendOptimistic = async (
    optimistic: Omit<ThreadMessage, 'id' | 'senderRole' | 'senderName' | 'createdAt' | 'pending'>,
    init: RequestInit
  ) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    stickToBottomRef.current = true;
    setError('');
    setMessages((prev) => [
      ...prev,
      {
        ...optimistic,
        id: tempId,
        senderRole: currentRole,
        senderName: 'You',
        createdAt: new Date().toISOString(),
        pending: true,
      },
    ]);

    try {
      const response = await fetch(`/api/rider-chats/${chatId}/messages`, { method: 'POST', ...init });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setMessages((prev) => prev.filter((message) => message.id !== tempId));
        setError(data?.error ?? 'Could not send your message.');
        return false;
      }

      setMessages((prev) => {
        const withoutTemp = prev.filter((message) => message.id !== tempId);
        return withoutTemp.some((message) => message.id === data.message.id) ? withoutTemp : [...withoutTemp, data.message];
      });
      // Status changes (e.g. a rider's first reply claiming the order) arrive via the stream.
      if (data.chat) applyChat(data.chat);
      return true;
    } catch {
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      setError('Could not reach the server.');
      return false;
    }
  };

  const handleSendText = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setDraft('');
    const ok = await sendOptimistic(
      { type: 'TEXT', body: text, lat: null, lng: null, durationSec: null, attachmentUrl: null },
      { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text }) }
    );
    if (!ok) setDraft((current) => current || text);
  };

  const sendFile = async (type: 'IMAGE' | 'VOICE', blob: Blob, fileName: string, durationSec?: number) => {
    const previewUrl = URL.createObjectURL(blob);
    const form = new FormData();
    form.append('type', type);
    form.append('file', new File([blob], fileName, { type: blob.type }));
    if (durationSec) form.append('durationSec', String(durationSec));

    setIsUploading(true);
    try {
      await sendOptimistic(
        { type, body: '', lat: null, lng: null, durationSec: durationSec ?? null, attachmentUrl: previewUrl },
        { body: form }
      );
    } finally {
      setIsUploading(false);
      // Keep the preview alive briefly so the swap to the server URL doesn't flash.
      window.setTimeout(() => URL.revokeObjectURL(previewUrl), 5000);
    }
  };

  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      if (compressed.size > MAX_CHAT_IMAGE_BYTES) {
        setError('This photo is too large to send.');
        return;
      }
      await sendFile('IMAGE', compressed, 'photo.jpg');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      setError('Location is not supported in this browser.');
      return;
    }

    setIsLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setIsLocating(false);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        await sendOptimistic(
          { type: 'LOCATION', body: 'Shared a location', lat, lng, durationSec: null, attachmentUrl: null },
          { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'LOCATION', lat, lng }) }
        );
      },
      () => {
        setIsLocating(false);
        setError('Please allow location access to share your location.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  const stopRecording = (discard: boolean) => {
    discardRecordingRef.current = discard;
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setRecordingSeconds(null);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice messages are not supported in this browser.');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Please allow microphone access to send a voice message.');
      return;
    }

    const mimeType = VOICE_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      if (discardRecordingRef.current) return;

      const durationSec = Math.min(MAX_CHAT_VOICE_SECONDS, Math.max(1, Math.round((Date.now() - recordingStartRef.current) / 1000)));
      const type = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0];
      const blob = new Blob(chunks, { type });

      if (blob.size > MAX_CHAT_VOICE_BYTES) {
        setError('This voice message is too long to send.');
        return;
      }

      const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      sendFile('VOICE', blob, `voice.${extension}`, durationSec);
    };

    setError('');
    discardRecordingRef.current = false;
    recorderRef.current = recorder;
    recordingStartRef.current = Date.now();
    recorder.start();
    setRecordingSeconds(0);
    recordingTimerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartRef.current) / 1000);
      setRecordingSeconds(elapsed);
      if (elapsed >= MAX_CHAT_VOICE_SECONDS) stopRecording(false);
    }, 250);
  };

  const isClosed = chatStatus === 'CLOSED';
  const isRecording = recordingSeconds !== null;
  const mediaDisabled = isUploading || isLocating || isRecording;
  const iconButtonClass =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand-gray transition hover:bg-gray-100 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} onScroll={handleListScroll} className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-center text-sm text-brand-gray">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-brand-gray">{emptyText}</p>
        ) : (
          messages.map((message) => {
            const isOwn = message.senderRole === currentRole;
            const isMedia = message.type !== 'TEXT';
            return (
              <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl text-sm ${isMedia ? 'p-1.5' : 'px-4 py-2'} ${
                    isOwn
                      ? 'bg-brand-red-primary text-white'
                      : message.senderRole === 'ADMIN'
                        ? 'bg-amber-50 text-ink ring-1 ring-amber-200'
                        : 'bg-gray-100 text-ink'
                  }`}
                >
                  {!isOwn && (
                    <p className={`mb-0.5 text-[11px] font-semibold text-accent ${isMedia ? 'px-2 pt-0.5' : ''}`}>
                      {message.senderName}
                    </p>
                  )}
                  <MessageContent
                    message={message}
                    isOwn={isOwn}
                    currentRole={currentRole}
                    onMediaLoad={() => scrollToBottom('auto')}
                  />
                  <p className={`mt-1 text-[10px] ${isMedia ? 'px-2 pb-0.5' : ''} ${isOwn ? 'text-white/70' : 'text-brand-gray'}`}>
                    {message.pending
                      ? 'Sending…'
                      : new Date(message.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error ? <p className="px-4 pb-1 text-xs text-danger">{error}</p> : null}

      {isClosed ? (
        <p className="border-t border-gray-100 p-3 text-center text-xs text-brand-gray">This chat has ended.</p>
      ) : isRecording ? (
        <div className="flex items-center gap-2 border-t border-gray-100 p-3">
          <button type="button" onClick={() => stopRecording(true)} className={iconButtonClass} aria-label="Discard voice message">
            <Trash2 className="h-4 w-4" />
          </button>
          <div className="flex flex-1 items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-danger">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
            Recording {formatDuration(recordingSeconds)}
            <span className="ml-auto text-xs font-normal text-danger/70">max {formatDuration(MAX_CHAT_VOICE_SECONDS)}</span>
          </div>
          <button
            type="button"
            onClick={() => stopRecording(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red-primary text-white hover:bg-brand-red-secondary"
            aria-label="Send voice message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSendText} className="flex items-center gap-1 border-t border-gray-100 p-2 sm:p-3">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelected} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={mediaDisabled}
            className={iconButtonClass}
            aria-label="Send a photo"
            title="Send a photo"
          >
            <Camera className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleShareLocation}
            disabled={mediaDisabled}
            className={iconButtonClass}
            aria-label="Share my location"
            title="Share my location"
          >
            <MapPin className={`h-5 w-5 ${isLocating ? 'animate-pulse text-accent' : ''}`} />
          </button>
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={isUploading ? 'Sending…' : placeholder}
            maxLength={MAX_RIDER_CHAT_MESSAGE_LENGTH}
            className="min-w-0 flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
          />
          {draft.trim() ? (
            <button
              type="submit"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red-primary text-white transition-colors hover:bg-brand-red-secondary"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={mediaDisabled}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red-primary text-white transition-colors hover:bg-brand-red-secondary disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Record a voice message"
              title="Record a voice message"
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </form>
      )}
    </div>
  );
}
