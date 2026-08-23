'use client';

import { motion } from 'framer-motion';
import { Zap, ShieldCheck, Clock } from 'lucide-react';
import Image from 'next/image';
import { BRAND, STATS } from '@/lib/data';

const HIGHLIGHTS = [
  { icon: Zap, text: 'Orders delivered in 30-60 minutes' },
  { icon: ShieldCheck, text: 'Verified vendors and delivery partners' },
  { icon: Clock, text: 'Open 12 PM to 1 AM, every day' },
];

export default function AuthBrandPanel({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-red-primary to-brand-red-secondary p-10 xl:p-12 text-white">
      <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10"
      >
        <div className="flex items-center space-x-2 mb-12">
          <div className="w-9 h-9 bg-white/15 backdrop-blur-sm rounded-lg flex items-center justify-center">
            <span className="font-bold text-sm">M</span>
          </div>
          <span className="font-bold text-lg">{BRAND.name}</span>
        </div>

        <h2 className="text-3xl xl:text-4xl font-bold leading-tight mb-4">
          {title}
        </h2>
        <p className="text-white/85 text-lg max-w-sm mb-10">{subtitle}</p>

        <ul className="space-y-4">
          {HIGHLIGHTS.map((item) => (
            <li key={item.text} className="flex items-center space-x-3">
              <div className="w-9 h-9 shrink-0 bg-white/15 backdrop-blur-sm rounded-full flex items-center justify-center">
                <item.icon className="w-4 h-4" />
              </div>
              <span className="text-sm text-white/90">{item.text}</span>
            </li>
          ))}
        </ul>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="relative z-10 mt-12"
      >
        <div className="relative h-40 w-full mb-8 rounded-2xl overflow-hidden bg-white/10">
          <Image
            src="/delivery-bike-hero.png"
            alt="Mangwaoo delivery rider on a bike"
            fill
            sizes="(min-width: 1024px) 480px, 100vw"
            className="object-cover object-center opacity-90"
          />
        </div>

        <div className="grid grid-cols-4 gap-4 border-t border-white/20 pt-6">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-xs text-white/75 mt-1 leading-tight">{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
