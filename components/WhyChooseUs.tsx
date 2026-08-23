'use client';

import { motion } from 'framer-motion';
import { WHY_CHOOSE_US } from '@/lib/data';
import { getServiceIcon } from '@/lib/utils';

export default function WhyChooseUs() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6 },
    },
  };

  return (
    <section id="why-us" className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-2 bg-brand-red-primary/10 text-brand-red-primary rounded-full text-sm font-semibold mb-4">
            Why Choose Us
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-brand-dark mb-6">
            Experience the Mangwaoo Difference
          </h2>
          <p className="text-lg text-brand-gray max-w-2xl mx-auto">
            We're committed to delivering excellence in every order.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {WHY_CHOOSE_US.map((feature) => (
            <motion.div
              key={feature.id}
              variants={itemVariants}
              className="group"
            >
              <div className="flex items-start space-x-4">
                {/* Icon */}
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-red-primary/20 to-brand-red-secondary/20 group-hover:from-brand-red-primary group-hover:to-brand-red-secondary transition-all duration-300">
                    <span className="text-2xl transform group-hover:scale-125 transition-transform duration-300">
                      {getServiceIcon(feature.icon)}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="pt-1">
                  <h3 className="text-xl font-bold text-brand-dark mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-brand-gray leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
