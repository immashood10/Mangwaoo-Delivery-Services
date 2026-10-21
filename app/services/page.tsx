import Link from 'next/link';
import { SERVICES, SERVICE_AREAS, BRAND } from '@/lib/data';
import { getServiceIcon } from '@/lib/utils';
import { ShoppingBag, ArrowRight } from 'lucide-react';

export default function Services() {
  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-brand-light to-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-2 bg-brand-red-primary/10 text-accent rounded-full text-sm font-semibold mb-4">
            Our Services
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-ink mb-6">
            Everything You Need, Delivered Fast
          </h1>
          <p className="text-lg text-brand-gray max-w-2xl mx-auto">
            We offer comprehensive delivery services across multiple categories to meet all your daily needs. Available from 12 PM to 1 AM, every day.
          </p>
        </div>
      </section>

      {/* Services Detailed */}
      <section className="py-16 md:py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {SERVICES.map((service, index) => (
              <div
                key={service.id}
                className={`flex flex-col ${
                  index % 2 === 1 && 'lg:order-2'
                }`}
              >
                {/* Illustration */}
                <div className="h-64 bg-gradient-to-br from-brand-light to-brand-red-primary/5 rounded-3xl flex items-center justify-center text-7xl mb-8">
                  {getServiceIcon(service.icon)}
                </div>

                {/* Content */}
                <div className="space-y-4">
                  <h2 className="text-3xl md:text-4xl font-bold text-ink">
                    {service.name}
                  </h2>
                  <p className="text-lg text-brand-gray leading-relaxed">
                    {service.description}
                  </p>

                  {/* Details */}
                  <div className="space-y-3 mt-6">
                    <h3 className="font-bold text-ink">
                      What's Included:
                    </h3>
                    <ul className="space-y-2">
                      {[
                        {
                          title: 'Fast Delivery',
                          desc: 'Usually within 30-60 minutes',
                        },
                        {
                          title: 'Verified Providers',
                          desc: 'Trusted restaurants and shops',
                        },
                        {
                          title: 'Easy Ordering',
                          desc: 'Simple ordering through MangwaooMart',
                        },
                        {
                          title: 'Great Prices',
                          desc: 'Competitive and transparent pricing',
                        },
                      ].map((item) => (
                        <li key={item.title} className="flex space-x-3">
                          <span className="text-accent font-bold">
                            ✓
                          </span>
                          <div>
                            <p className="font-semibold text-ink">
                              {item.title}
                            </p>
                            <p className="text-sm text-brand-gray">
                              {item.desc}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA */}
                  <Link
                    href="/mart"
                    className="inline-flex items-center space-x-2 bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all mt-6"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    <span>Order {service.name}</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 md:py-24 bg-brand-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-ink mb-6">
              How It Works
            </h2>
            <p className="text-lg text-brand-gray max-w-2xl mx-auto">
              Ordering from Mangwaoo is simple and straightforward
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: '1',
                title: 'Choose Category',
                description: 'Select from food, groceries, dairy, or medicines',
              },
              {
                step: '2',
                title: 'Place Order',
                description: 'Add items to your cart and check out',
              },
              {
                step: '3',
                title: 'Real-time Tracking',
                description: 'Track your delivery in real-time',
              },
              {
                step: '4',
                title: 'Fast Delivery',
                description: 'Receive your order fresh and on time',
              },
            ].map((item, index) => (
              <div
                key={index}
                className="bg-surface rounded-2xl p-8 shadow-soft text-center relative"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-red-primary to-brand-red-secondary flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-bold text-ink mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-brand-gray">{item.description}</p>

                {/* Arrow */}
                {index < 3 && (
                  <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2">
                    <ArrowRight className="w-6 h-6 text-accent" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Hours */}
      <section className="py-16 md:py-24 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Hours */}
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-ink">
                Service Hours
              </h2>
              <div className="bg-gradient-to-br from-brand-red-primary to-brand-red-secondary rounded-2xl p-8 text-white">
                <p className="text-2xl font-bold mb-2">⏰ {BRAND.hours}</p>
                <p className="text-white/90">
                  We're available every day, including weekends and holidays.
                </p>
              </div>
              <div className="space-y-3">
                <h3 className="font-bold text-ink">Why 12 PM to 1 AM?</h3>
                <p className="text-brand-gray leading-relaxed">
                  We've chosen these hours to perfectly align with Karachi's lifestyle. From lunch time through midnight, we're here to serve your cravings and needs. Whether you need breakfast alternatives at noon, lunch, evening snacks, or late-night food and essentials, we've got you covered.
                </p>
              </div>
            </div>

            {/* Visual */}
            <div className="h-96 bg-gradient-to-br from-brand-light to-brand-red-primary/10 rounded-3xl flex items-center justify-center text-6xl">
              🕐
            </div>
          </div>
        </div>
      </section>

      {/* Service Areas */}
      <section className="py-16 md:py-24 bg-brand-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-ink mb-12 text-center">
            Service Areas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {SERVICE_AREAS.map((area) => (
              <div
                key={area.id}
                className="bg-surface rounded-2xl p-6 text-center shadow-soft hover:shadow-md transition-all"
              >
                <p className="font-bold text-ink mb-2">📍 {area.name}</p>
                <p className="text-sm text-success font-semibold">Active</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className="text-brand-gray">
              More areas coming soon! Interested in your area? Contact us.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Ready to Order?
          </h2>
          <p className="text-lg text-white/90 mb-8">
            Start enjoying fast, reliable delivery today!
          </p>
          <Link
            href="/mart"
            className="inline-flex items-center space-x-2 bg-surface text-accent px-8 py-4 rounded-2xl font-semibold hover:shadow-2xl transition-all"
          >
            <ShoppingBag className="w-5 h-5" />
            <span>Order Now</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
