import { ShieldAlert } from 'lucide-react';

const TIPS = [
  'Only meet in public / crowded places such as metro stations and malls.',
  'Never go alone to meet a buyer / seller, always take someone with you.',
  'Check and inspect the product properly before purchasing it.',
  'Never pay / transfer any money in advance before inspecting the product.',
];

/** Meet-in-person safety reminder shown on vehicle ads. */
export default function SafetyTips() {
  return (
    <aside aria-labelledby="safety-tips-heading" className="rounded-2xl border border-gray-200 bg-brand-light p-5">
      <h2 id="safety-tips-heading" className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
        <ShieldAlert className="h-5 w-5 shrink-0 text-warning" />
        Your safety matters to us!
      </h2>
      <ul className="space-y-2 text-sm text-brand-gray">
        {TIPS.map((tip) => (
          <li key={tip} className="flex gap-2">
            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
