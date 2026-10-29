// A place somebody chose (typed, "my location" or a spot on the map): its address text and where it is. Client-safe.

export type PickedLocation = {
  label: string;
  lat: number;
  lng: number;
};
