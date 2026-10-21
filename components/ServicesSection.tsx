'use client';

import { motion } from 'framer-motion';
import { SERVICES } from '@/lib/data';
import { getServiceIcon } from '@/lib/utils';

export default function ServicesSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  return (
    <section id="services" className="py-16 md:py-24 bg-brand-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-2 bg-brand-red-primary/10 text-accent rounded-full text-sm font-semibold mb-4">
            Our Services
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-ink mb-6">
            What We Deliver
          </h2>
          <p className="text-lg text-brand-gray max-w-2xl mx-auto">
            We offer multiple delivery categories to meet all your daily needs.
          </p>
        </motion.div>

        {/* Services Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {SERVICES.map((service) => (
            <motion.div
              key={service.id}
              variants={itemVariants}
              whileHover={{ y: -10, transition: { duration: 0.3 } }}
              className="bg-surface rounded-2xl p-8 shadow-soft hover:shadow-md transition-all duration-300 group cursor-pointer"
            >
              {/* Icon */}
              <div className="text-5xl mb-6 transform group-hover:scale-110 transition-transform duration-300">
                {getServiceIcon(service.icon)}
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-ink mb-3">
                {service.name}
              </h3>
              <p className="text-brand-gray text-sm leading-relaxed">
                {service.description}
              </p>

              {/* Bottom Accent */}
              <div className="mt-6 h-1 w-12 bg-gradient-to-r from-brand-red-primary to-brand-red-secondary rounded-full transform group-hover:w-full transition-all duration-300" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
