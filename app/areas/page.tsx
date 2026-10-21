import Link from 'next/link';
import LocationAreaFilter from '@/components/LocationAreaFilter';
import { MapPin, ArrowRight } from 'lucide-react';

export default function Areas() {
  return (
    <div className="w-full">
      <section className="py-16 md:py-24 bg-gradient-to-br from-brand-light to-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-2 bg-brand-red-primary/10 text-accent rounded-full text-sm font-semibold mb-4">
            Coverage Map
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-ink mb-6">
            Service Areas
          </h1>
          <p className="text-lg text-brand-gray max-w-2xl mx-auto">
            Select your pickup location to see only the delivery areas closest to you.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-16">
            <div className="relative h-96 bg-gradient-to-br from-blue-50 to-blue-100 rounded-3xl overflow-hidden shadow-soft">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-20 h-20 text-accent mx-auto opacity-50 mb-4" />
                  <p className="text-lg font-semibold text-brand-gray">
                    Service Coverage Map
                  </p>
                  <p className="text-brand-gray mt-2">
                    Currently covering 5 areas in Karachi
                  </p>
                </div>
              </div>
            </div>
          </div>

          <LocationAreaFilter variant="detailed" />
        </div>
      </section>

      <section className="py-16 md:py-24 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-brand-red-primary/10 to-brand-red-secondary/10 border border-accent/20 rounded-3xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold text-ink mb-6">
              Expansion Plans
            </h2>
            <p className="text-brand-gray leading-relaxed mb-6">
              Mangwaoo is growing! We are actively working to expand our service areas to more neighborhoods across Karachi.
            </p>

            <div className="bg-surface rounded-2xl p-6 mb-6">
              <h3 className="font-bold text-ink mb-4">
                Coming Soon to More Areas:
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  'Saddar',
                  'Gulshan-e-Iqbal',
                  'DHA',
                  'Clifton',
                  'Bagh Ibne Qasim',
                  'Malir',
                ].map((area) => (
                  <div
                    key={area}
                    className="px-4 py-2 bg-brand-light rounded-lg text-center text-sm font-medium text-brand-gray"
                  >
                    {area}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-brand-gray mb-6">
              Want us to reach your area first? Let us know and we will use your feedback while planning expansion.
            </p>

            <Link
              href="/contact"
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              <span>Suggest Your Area</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-brand-light">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-brand-red-primary to-brand-red-secondary rounded-3xl p-8 md:p-12 text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">
              Not Sure If We Deliver to You?
            </h2>
            <p className="text-center text-white/90 mb-8 max-w-2xl mx-auto">
              Contact us directly and we will let you know right away.
            </p>
            <div className="flex justify-center">
              <Link
                href="/contact"
                className="inline-flex items-center space-x-2 bg-surface text-accent px-8 py-4 rounded-2xl font-semibold hover:shadow-2xl transition-all"
              >
                <span>Check Delivery Availability</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
