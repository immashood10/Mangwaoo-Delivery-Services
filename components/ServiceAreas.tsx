'use client';

import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import LocationAreaFilter from '@/components/LocationAreaFilter';

export default function ServiceAreas() {
  return (
    <section id="areas" className="py-16 md:py-24 bg-brand-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-2 bg-brand-red-primary/10 text-brand-red-primary rounded-full text-sm font-semibold mb-4">
            Coverage Area
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-brand-dark mb-6">
            Service Areas
          </h2>
          <p className="text-lg text-brand-gray max-w-2xl mx-auto">
            Select a pickup location to see the delivery areas nearest to you.
          </p>
        </motion.div>

        <div className="mb-12">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="relative h-64 md:h-96 bg-white rounded-3xl shadow-soft overflow-hidden"
          >
            <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-16 h-16 text-brand-red-primary mx-auto mb-4 opacity-50" />
                <p className="text-brand-gray font-semibold">Service Coverage Map</p>
                <p className="text-sm text-brand-gray mt-2">5 Active Areas in Karachi</p>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <LocationAreaFilter />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-12 bg-gradient-to-r from-brand-red-primary/10 to-brand-red-secondary/10 rounded-2xl p-8 text-center border border-brand-red-primary/20"
        >
          <p className="text-brand-dark font-semibold">
            More areas coming soon! Stay tuned for expansion updates.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
