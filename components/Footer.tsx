'use client';

import Link from 'next/link';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { BRAND, SERVICE_AREAS } from '@/lib/data';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-brand-dark text-white">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-brand-red-primary to-brand-red-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">M</span>
              </div>
              <h3 className="text-xl font-bold">{BRAND.name}</h3>
            </div>
            <p className="text-gray-400 text-sm">
              {BRAND.tagline}
            </p>
            <p className="text-gray-400 text-sm">
              Karachi's trusted delivery service for food, groceries, dairy, and medicines.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-bold text-lg">Quick Links</h4>
            <ul className="space-y-2 text-gray-400">
              <li>
                <Link href="/" className="hover:text-brand-red-primary transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-brand-red-primary transition-colors">
                  Services
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-brand-red-primary transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Service Areas */}
          <div className="space-y-4">
            <h4 className="font-bold text-lg">Service Areas</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              {SERVICE_AREAS.map((area) => (
                <li key={area.id} className="hover:text-brand-red-primary transition-colors">
                  {area.name}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h4 className="font-bold text-lg">Get in Touch</h4>
            <div className="space-y-3 text-gray-400 text-sm">
              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 mt-0.5 text-brand-red-secondary flex-shrink-0" />
                <span>{BRAND.hours}</span>
              </div>
              <div className="flex items-start space-x-3">
                <Phone className="w-5 h-5 mt-0.5 text-brand-red-secondary flex-shrink-0" />
                <a href={`tel:${BRAND.phone}`} className="hover:text-brand-red-primary transition-colors">
                  {BRAND.phone}
                </a>
              </div>
              <div className="flex items-start space-x-3">
                <Mail className="w-5 h-5 mt-0.5 text-brand-red-secondary flex-shrink-0" />
                <a href={`mailto:${BRAND.email}`} className="hover:text-brand-red-primary transition-colors">
                  {BRAND.email}
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-gray-400 text-sm">
            <p>&copy; {currentYear} {BRAND.name}. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="#" className="hover:text-brand-red-primary transition-colors">
                Privacy Policy
              </Link>
              <Link href="#" className="hover:text-brand-red-primary transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
