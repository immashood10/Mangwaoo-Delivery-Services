'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';
import { FUTURE_ROADMAP } from '@/lib/data';

export default function FutureVision() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
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
    <section id="vision" className="py-16 md:py-24 bg-gradient-to-br from-brand-dark to-gray-900 text-white relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-red-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-red-secondary/10 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-2 bg-brand-red-primary/20 text-accent rounded-full text-sm font-semibold mb-4">
            Our Vision
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Building the Future of Delivery
          </h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Mangwaoo is evolving into a complete multi-vendor eCommerce marketplace, combining the power of Foodpanda and Daraz.
          </p>
        </motion.div>

        {/* Roadmap */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="space-y-8"
        >
          {FUTURE_ROADMAP.map((phase, index) => (
            <motion.div
              key={phase.phase}
              variants={itemVariants}
              className="relative"
            >
              <div className="flex gap-6 md:gap-8">
                {/* Timeline Dot */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-red-primary to-brand-red-secondary flex items-center justify-center flex-shrink-0 shadow-lg">
                      <span className="text-white font-bold text-lg">
                        {index + 1}
                      </span>
                    </div>
                  </div>
                  {index < FUTURE_ROADMAP.length - 1 && (
                    <div className="w-1 h-32 bg-gradient-to-b from-brand-red-primary/50 to-transparent mt-4" />
                  )}
                </div>

                {/* Content */}
                <div className="pb-8 pt-2 flex-grow">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10 hover:border-accent/50 transition-colors duration-300">
                    <div className="flex items-start gap-4 mb-4">
                      <h3 className="text-2xl md:text-3xl font-bold">
                        {phase.phase}: {phase.title}
                      </h3>
                    </div>
                    <p className="text-gray-300 mb-6 leading-relaxed">
                      {phase.description}
                    </p>

                    {/* Features List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {phase.features.map((feature) => (
                        <div
                          key={feature}
                          className="flex items-center space-x-2 text-sm text-gray-300"
                        >
                          <div className="w-2 h-2 rounded-full bg-brand-red-primary" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <p className="text-gray-300 mb-6 flex items-center justify-center gap-2">
            <Zap className="w-5 h-5 text-accent" />
            More exciting features coming soon!
          </p>
          <p className="text-gray-400">
            Join us on this journey to revolutionize delivery in Karachi
          </p>
        </motion.div>
      </div>
    </section>
  );
}
