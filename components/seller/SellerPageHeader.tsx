import type { LucideIcon } from 'lucide-react';

/** Title block at the top of each seller dashboard page. */
export default function SellerPageHeader({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="mb-8">
      <h1 className="flex items-center gap-3 text-2xl font-bold text-ink md:text-3xl">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red-primary/10 text-accent">
          <Icon className="h-5 w-5" />
        </span>
        {title}
      </h1>
      {description ? <p className="mt-2 max-w-2xl text-sm text-brand-gray">{description}</p> : null}
    </div>
  );
}
