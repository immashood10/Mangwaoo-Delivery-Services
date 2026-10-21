import { Flag, MapPin, Navigation } from 'lucide-react';
import type { RiderChatSummary } from '@/lib/rider-chat-types';

type RouteChat = Pick<RiderChatSummary, 'addressText' | 'lat' | 'lng' | 'pickupText' | 'pickupLat' | 'pickupLng'>;

function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function viewUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function Stop({
  icon,
  label,
  text,
  lat,
  lng,
  showDirections,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
  lat: number | null;
  lng: number | null;
  showDirections: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-gray">{label}</p>
        <p className="text-xs text-ink">{text}</p>
        {lat !== null && lng !== null ? (
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs font-semibold">
            <a href={viewUrl(lat, lng)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              View map
            </a>
            {showDirections ? (
              <a
                href={directionsUrl(lat, lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                <Navigation className="h-3 w-3" />
                Directions
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Pickup → drop-off for an order chat, with Google Maps links (directions are for riders). */
export default function RouteSummary({
  chat,
  showDirections = false,
  className = '',
}: {
  chat: RouteChat;
  showDirections?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {chat.pickupText ? (
        <Stop
          icon={<MapPin className="h-4 w-4 text-success" />}
          label="Pickup"
          text={chat.pickupText}
          lat={chat.pickupLat}
          lng={chat.pickupLng}
          showDirections={showDirections}
        />
      ) : null}
      <Stop
        icon={<Flag className="h-4 w-4 text-accent" />}
        label={chat.pickupText ? 'Drop-off' : 'Delivery address'}
        text={chat.addressText}
        lat={chat.lat}
        lng={chat.lng}
        showDirections={showDirections}
      />
    </div>
  );
}
