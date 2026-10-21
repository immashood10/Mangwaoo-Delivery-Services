'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { BRAND } from '@/lib/data';

export default function Contact() {
  return (
    <Suspense fallback={null}>
      <ContactForm />
    </Suspense>
  );
}

function ContactForm() {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState(() => {
    const service = searchParams.get('service');
    return {
      name: '',
      email: '',
      phone: '',
      subject: service ? 'service' : '',
      message: service ? `Hi Mangwaoo, I'd like to request a ${service} professional.` : '',
    };
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setFormError(data?.error ?? 'Could not send your message. Please try again.');
        return;
      }

      setIsSubmitted(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-brand-light to-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-2 bg-brand-red-primary/10 text-accent rounded-full text-sm font-semibold mb-4">
            Get in Touch
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-ink mb-6">
            Contact Mangwaoo
          </h1>
          <p className="text-lg text-brand-gray max-w-2xl mx-auto">
            Have questions, feedback, or partnership inquiries? We&apos;d love to hear from you!
          </p>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-16 md:py-24 bg-brand-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Form */}
            <div className="bg-surface rounded-3xl p-8 md:p-12 shadow-soft">
              <h2 className="text-2xl md:text-3xl font-bold text-ink mb-2">
                Send us a Message
              </h2>
              <p className="text-sm text-brand-gray mb-6">
                We&apos;ll receive it on <span className="font-semibold text-ink">{BRAND.phone}</span>.
              </p>

              {isSubmitted ? (
                <div className="flex flex-col items-center justify-center text-center py-12">
                  <CheckCircle2 className="w-12 h-12 text-success mb-4" />
                  <p className="text-lg font-semibold text-ink mb-2">Message sent!</p>
                  <p className="text-sm text-brand-gray">We&apos;ll get back to you soon.</p>
                  <button
                    type="button"
                    onClick={() => setIsSubmitted(false)}
                    className="mt-6 text-sm font-semibold text-accent hover:underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-ink mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-ink mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="your@email.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-ink mb-2">
                        Phone
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="0300-1234567"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-ink mb-2">
                      Subject
                    </label>
                    <select
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                      required
                    >
                      <option value="">Select a subject</option>
                      <option value="general">General Inquiry</option>
                      <option value="feedback">Feedback</option>
                      <option value="vendor">Vendor Partnership</option>
                      <option value="service">Service Request</option>
                      <option value="complaint">Complaint</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-ink mb-2">
                      Message
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Tell us what's on your mind..."
                      rows={5}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none"
                      required
                    />
                  </div>

                  {formError ? <p className="text-sm text-danger">{formError}</p> : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? 'Sending…' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>

            {/* Info */}
            <div className="flex flex-col justify-between">
              <div className="space-y-8 mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-ink mb-4">
                    Why Contact Us?
                  </h3>
                  <ul className="space-y-4">
                    {[
                      {
                        title: 'Customer Support',
                        desc: 'Have an issue with your order? We\'re here to help!',
                      },
                      {
                        title: 'Feedback',
                        desc: 'Help us improve by sharing your suggestions',
                      },
                      {
                        title: 'Vendor Partnership',
                        desc: 'Interested in listing your restaurant or shop?',
                      },
                      {
                        title: 'Press & Media',
                        desc: 'Looking for information for coverage?',
                      },
                    ].map((item) => (
                      <li key={item.title} className="flex space-x-3">
                        <span className="text-accent text-xl flex-shrink-0">
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
              </div>

              {/* Quick Response */}
              <div className="bg-gradient-to-r from-brand-red-primary/10 to-brand-red-secondary/10 rounded-2xl p-6 border border-accent/20">
                <p className="text-sm text-ink font-semibold mb-2">
                  💬 Quick Response
                </p>
                <p className="text-sm text-brand-gray">
                  We typically respond to inquiries within 24 hours.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-24 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-ink mb-12 text-center">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {[
              {
                q: 'What are the service hours?',
                a: `We operate from ${BRAND.hours} every day, including weekends and holidays.`,
              },
              {
                q: 'What areas do you cover?',
                a: 'We currently serve Gulshan e Iqbal, North Nazimabad, North Karachi, Disco More, and New Karachi.',
              },
              {
                q: 'How long does delivery usually take?',
                a: 'Most deliveries are completed within 30-60 minutes, depending on the order and location.',
              },
              {
                q: 'How can I place an order?',
                a: 'Browse and order directly through MangwaooMart or Food on this site — add items to your cart and check out.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'Currently, we accept cash on delivery and EasyPaisa/JazzCash. Online card payments coming soon!',
              },
              {
                q: 'Can vendors join Mangwaoo?',
                a: 'Yes! We are always looking for new restaurant and shop partners. Contact us for vendor registration details.',
              },
            ].map((item, index) => (
              <details
                key={index}
                className="group border border-gray-200 rounded-lg p-6 cursor-pointer"
              >
                <summary className="font-semibold text-ink flex items-center justify-between">
                  {item.q}
                  <ArrowRight className="w-5 h-5 transform group-open:rotate-90 transition-transform" />
                </summary>
                <p className="text-brand-gray mt-4">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
