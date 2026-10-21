'use client';

import { motion } from 'framer-motion';
import { ArrowRight, MessageCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { STATS } from '@/lib/data';

export default function Hero() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8 },
    },
  };

  return (
    <section className="relative min-h-[600px] md:min-h-[700px] flex items-center overflow-hidden bg-surface">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-light via-surface to-surface opacity-60" />

      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-red-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-red-secondary/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        >
          <div className="space-y-6">
            <motion.div variants={itemVariants}>
              <span className="inline-block px-4 py-2 bg-brand-red-primary/10 text-accent rounded-full text-sm font-semibold">
                Fast Delivery Across Karachi
              </span>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-ink leading-tight"
            >
              Karachi&apos;s Trusted{' '}
              <span className="bg-gradient-to-r from-brand-red-primary to-brand-red-secondary bg-clip-text text-transparent dark:from-accent dark:to-accent">
                Delivery Service
              </span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-lg text-brand-gray leading-relaxed max-w-md"
            >
              Order fast food, groceries, dairy items, and medicines with quick and reliable delivery. Available 12 PM to 1 AM, every day.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/mart"
                className="group flex items-center justify-center space-x-2 bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white px-8 py-4 rounded-2xl font-semibold hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Order on Mangwaoo</span>
              </Link>
              <Link
                href="/services"
                className="group flex items-center justify-center space-x-2 border-2 border-accent text-accent px-8 py-4 rounded-2xl font-semibold hover:bg-brand-red-primary hover:text-white transition-all duration-300"
              >
                <span>Explore Services</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>

            <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8">
              {STATS.map((stat) => (
                <div key={stat.label} className="bg-surface rounded-2xl p-4 shadow-soft text-center">
                  <p className="text-2xl font-bold text-accent">{stat.value}</p>
                  <p className="text-xs text-brand-gray mt-1">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            variants={itemVariants}
            className="relative h-72 md:h-full min-h-72 flex items-center justify-center"
          >
            <div className="relative w-full h-full max-w-xs">
              <motion.div
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="relative w-full h-full overflow-hidden rounded-3xl bg-gradient-to-br from-brand-red-primary/10 to-brand-red-secondary/10 shadow-soft">
                  <Image
                    src="/delivery-bike-hero.png"
                    alt="Mangwaoo delivery rider on a bike"
                    fill
                    priority
                    sizes="(min-width: 1024px) 320px, 100vw"
                    className="object-cover object-center"
                  />
                </div>
              </motion.div>

              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border-2 border-dashed border-accent/30"
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
