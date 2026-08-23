import Link from 'next/link';
import { PROFESSIONAL_SERVICES } from '@/lib/data';
import { MessageCircle } from 'lucide-react';

export default function ServicesHub() {
  return (
    <div className="w-full">
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-brand-light to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-2 bg-brand-red-primary/10 text-brand-red-primary rounded-full text-sm font-semibold mb-4">
            Services
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-brand-dark mb-6">
            Skilled Professionals, On Demand
          </h1>
          <p className="text-lg text-brand-gray max-w-2xl mx-auto">
            From creative work to home repairs, request a trusted professional and we&apos;ll get back to you.
          </p>
        </div>
      </section>

      {/* Services grid */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PROFESSIONAL_SERVICES.map((service) => (
              <div
                key={service.id}
                id={service.slug}
                className="scroll-mt-24 flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-soft hover:shadow-md transition-all duration-300"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-red-primary/10 text-3xl">
                  {service.icon}
                </div>
                <h2 className="text-xl font-bold text-brand-dark mb-2">{service.name}</h2>
                <p className="text-brand-gray leading-relaxed mb-6 flex-1">{service.description}</p>
                <Link
                  href={`/contact?service=${encodeURIComponent(service.name)}`}
                  className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white px-5 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Request this service</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Need Something Else?</h2>
          <p className="text-lg text-white/90 mb-8">
            Tell us what you need and we&apos;ll connect you with the right professional.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center space-x-2 bg-white text-brand-red-primary px-8 py-4 rounded-2xl font-semibold hover:shadow-2xl transition-all"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Message Us</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
