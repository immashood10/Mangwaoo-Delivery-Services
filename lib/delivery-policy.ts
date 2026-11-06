export const DELIVERY_OPTIONS = [
  { days: 0, label: 'Immediate' }, { days: 3, label: '3 days' },
  { days: 5, label: '5 days' }, { days: 7, label: '7 days' },
] as const;
export function validDeliveryDays(value: unknown): value is 0 | 3 | 5 | 7 {
  return typeof value === 'number' && [0, 3, 5, 7].includes(value);
}
export function deliveryPlan(input: { days: number; distanceKm: number | null; sameCity: boolean }) {
  const remote = !input.sameCity || input.distanceKm === null || input.distanceKm > 10;
  if (remote) return { vendorFulfilled: true, deliveryMinDays: 5, deliveryMaxDays: 7, label: 'Vendor delivery · 5–7 days' };
  if (input.days > 0) return { vendorFulfilled: true, deliveryMinDays: input.days, deliveryMaxDays: input.days, label: `Vendor delivery · ${input.days} days` };
  return { vendorFulfilled: false, deliveryMinDays: 0, deliveryMaxDays: 0, label: 'Immediate · assigned by your area team' };
}
