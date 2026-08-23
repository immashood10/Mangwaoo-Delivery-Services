'use client';

import { useMemo, useState } from 'react';
import { LocateFixed, MapPin, Navigation, Search } from 'lucide-react';
import { SERVICE_AREAS } from '@/lib/data';

type Coordinates = {
  lat: number;
  lng: number;
};

type LocationAreaFilterProps = {
  variant?: 'compact' | 'detailed';
};

const NEARBY_BUFFER_KM = 1.5;

function distanceInKm(from: Coordinates, to: Coordinates) {
  const earthRadiusKm = 6371;
  const latDistance = ((to.lat - from.lat) * Math.PI) / 180;
  const lngDistance = ((to.lng - from.lng) * Math.PI) / 180;
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;

  const haversine =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(fromLat) *
      Math.cos(toLat) *
      Math.sin(lngDistance / 2) *
      Math.sin(lngDistance / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export default function LocationAreaFilter({ variant = 'compact' }: LocationAreaFilterProps) {
  const [pickupLocation, setPickupLocation] = useState<Coordinates | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [locationStatus, setLocationStatus] = useState('');

  const filteredAreas = useMemo(() => {
    if (!pickupLocation) {
      return SERVICE_AREAS.map((area) => ({ ...area, distanceKm: null }));
    }

    const areasWithDistance = SERVICE_AREAS.map((area) => ({
      ...area,
      distanceKm: distanceInKm(pickupLocation, area.coordinates),
    })).sort((a, b) => a.distanceKm - b.distanceKm);

    const nearbyAreas = areasWithDistance.filter(
      (area) => area.distanceKm <= area.deliveryRadiusKm + NEARBY_BUFFER_KM
    );

    return nearbyAreas.length > 0 ? nearbyAreas : areasWithDistance.slice(0, 3);
  }, [pickupLocation]);

  const isFiltered = Boolean(pickupLocation);
  const areaCountText = `${filteredAreas.length} ${filteredAreas.length === 1 ? 'area' : 'areas'}`;

  function handleAreaChange(areaId: string) {
    setSelectedAreaId(areaId);

    if (!areaId) {
      setPickupLocation(null);
      setLocationLabel('');
      setLocationStatus('');
      return;
    }

    const area = SERVICE_AREAS.find((item) => item.id === Number(areaId));

    if (!area) {
      return;
    }

    setPickupLocation(area.coordinates);
    setLocationLabel(area.name);
    setLocationStatus('Showing delivery areas nearest to your pickup location.');
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('Location is not available in this browser. Pick an area below.');
      return;
    }

    setLocationStatus('Finding your pickup location...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSelectedAreaId('');
        setPickupLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationLabel('My location');
        setLocationStatus('Showing delivery areas nearest to your pickup location.');
      },
      () => {
        setLocationStatus('Could not access your location. Pick your nearest area below.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl shadow-soft border border-black/5 p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <label className="block">
              <span className="block text-sm font-semibold text-brand-dark mb-2">
                Pickup location
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-gray" />
                <select
                  value={selectedAreaId}
                  onChange={(event) => handleAreaChange(event.target.value)}
                  className="w-full appearance-none rounded-xl border border-black/10 bg-white py-3 pl-10 pr-4 text-brand-dark outline-none transition focus:border-brand-red-primary focus:ring-2 focus:ring-brand-red-primary/20"
                >
                  <option value="">Select your nearest area</option>
                  {SERVICE_AREAS.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-dark px-5 font-semibold text-white transition hover:bg-brand-red-primary"
            >
              <LocateFixed className="h-5 w-5" />
              <span>Use my location</span>
            </button>
          </div>

          <div className="rounded-xl bg-brand-light px-4 py-3 text-sm font-semibold text-brand-dark">
            {isFiltered ? `${areaCountText} nearby` : 'All active areas'}
          </div>
        </div>

        {(locationStatus || locationLabel) && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-brand-red-primary/10 p-3 text-sm text-brand-dark">
            <Navigation className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-red-primary" />
            <p>
              {locationLabel && <span className="font-semibold">{locationLabel}: </span>}
              {locationStatus}
            </p>
          </div>
        )}
      </div>

      <div
        className={
          variant === 'detailed'
            ? 'grid grid-cols-1 lg:grid-cols-2 gap-6'
            : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'
        }
      >
        {filteredAreas.map((area, index) => (
          <div
            key={area.id}
            className={
              variant === 'detailed'
                ? 'bg-white rounded-2xl p-8 shadow-soft hover:shadow-md transition-all'
                : 'bg-white rounded-2xl p-6 shadow-soft hover:shadow-md transition-all duration-300 text-center group'
            }
          >
            {variant === 'detailed' ? (
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-red-primary to-brand-red-secondary font-bold text-white">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-grow">
                  <h3 className="text-xl font-bold text-brand-dark mb-3">{area.name}</h3>
                  <p className="text-brand-gray leading-relaxed mb-4">{area.description}</p>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-brand-dark">What You Get:</p>
                    <ul className="text-sm text-brand-gray space-y-1">
                      <li>Fast delivery service</li>
                      <li>Trusted delivery partners</li>
                      <li>Available 12 PM - 1 AM</li>
                      <li>Fair pricing</li>
                    </ul>
                  </div>
                  {area.distanceKm !== null && (
                    <p className="mt-4 text-sm font-semibold text-brand-red-primary">
                      {area.distanceKm.toFixed(1)} km from pickup
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-brand-red-primary/20 to-brand-red-secondary/20 rounded-full group-hover:from-brand-red-primary group-hover:to-brand-red-secondary transition-all duration-300 mb-4">
                  <MapPin className="w-6 h-6 text-brand-red-primary group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="font-bold text-brand-dark mb-2">{area.name}</h3>
                <p className="text-sm text-brand-gray">{area.description}</p>
                {area.distanceKm !== null && (
                  <p className="mt-3 text-xs font-semibold text-brand-red-primary">
                    {area.distanceKm.toFixed(1)} km away
                  </p>
                )}
                <div className="mt-4">
                  <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                    Active
                  </span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
