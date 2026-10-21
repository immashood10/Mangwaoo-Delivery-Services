import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ScrollToTop from '@/components/ScrollToTop';
import HideOnDashboardRoutes from '@/components/HideOnDashboardRoutes';
import { CartProvider } from '@/lib/cart-context';
import { AuthProvider } from '@/lib/auth-context';
import { FavouritesProvider } from '@/lib/favourites-context';
import { DeliveryAddressProvider } from '@/lib/delivery-address-context';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Follow the visitor's device theme (light stays the default). The theme-color tints
// the mobile browser's address bar to match the page in each mode.
export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#121211' },
  ],
};

export const metadata: Metadata = {
  title: 'Mangwaoo.com - Fast Delivery Service in Karachi',
  description:
    'Order fast food, groceries, dairy items, and medicines with quick and reliable delivery. Available 12 PM to 1 AM daily.',
  keywords: 'delivery, karachi, food, groceries, dairy, medicines, fast delivery',
  openGraph: {
    title: 'Mangwaoo.com - Time Bachao, Mangwaoo Chalao!',
    description: 'Karachi\'s Trusted Delivery Service',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} scroll-smooth`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen flex flex-col bg-surface antialiased">
        <AuthProvider>
          <CartProvider>
            <FavouritesProvider>
              <DeliveryAddressProvider>
                <HideOnDashboardRoutes>
                  <Navbar />
                </HideOnDashboardRoutes>
                <main className="flex-grow">{children}</main>
                <HideOnDashboardRoutes>
                  <Footer />
                </HideOnDashboardRoutes>
                <ScrollToTop />
              </DeliveryAddressProvider>
            </FavouritesProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
