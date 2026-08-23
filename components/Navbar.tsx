'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X, MapPin, LocateFixed, Search, ShoppingCart, ShoppingBag, ChevronDown, Store, LogOut, ShieldCheck, PackageSearch } from 'lucide-react';
import { PROFESSIONAL_SERVICES } from '@/lib/data';
import SignInModal from './SignInModal';
import { useCart } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';

type AddressSuggestion = {
  id: string;
  label: string;
  postalCode: string;
  lat: number;
  lng: number;
};

export default function Navbar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressQuery, setAddressQuery] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [isLocatingAddress, setIsLocatingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<AddressSuggestion | null>(null);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [isServicesMenuOpen, setIsServicesMenuOpen] = useState(false);
  const servicesMenuRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const { cartCount } = useCart();
  const { user, isLoading: isAuthLoading, logout, isSignInOpen, openSignIn, closeSignIn } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isAddressModalOpen && !isSignInOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAddressModalOpen, isSignInOpen]);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (!isServicesMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (servicesMenuRef.current && !servicesMenuRef.current.contains(event.target as Node)) {
        setIsServicesMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isServicesMenuOpen]);

  useEffect(() => {
    const shouldSearch = isAddressModalOpen && addressQuery.trim().length >= 3;
    const searchQuery = postalCode.trim() ? `${addressQuery}, ${postalCode}` : addressQuery;
    const controller = new AbortController();

    const timeoutId = window.setTimeout(async () => {
      if (!shouldSearch) {
        setAddressSuggestions([]);
        return;
      }

      setIsSearchingAddress(true);
      setAddressError('');

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&viewbox=66.75,25.06,67.17,24.78&bounded=1&q=${encodeURIComponent(searchQuery)}`,
          { signal: controller.signal, headers: { Accept: 'application/json' } }
        );

        if (!response.ok) {
          throw new Error('Address search failed');
        }

        const results = (await response.json()) as Array<{
          place_id: number;
          display_name: string;
          lat: string;
          lon: string;
          address?: { postcode?: string };
        }>;

        setAddressSuggestions(
          results.map((result) => ({
            id: String(result.place_id),
            label: result.display_name,
            postalCode: result.address?.postcode ?? '',
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
          }))
        );
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setAddressError('Could not fetch address suggestions. Please try again.');
        }
      } finally {
        setIsSearchingAddress(false);
      }
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [addressQuery, postalCode, isAddressModalOpen]);

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Sell on Mangwaoo', href: '/sell' },
    { name: 'MangwaooMart', href: '/mart' },
    { name: 'Food', href: '/gulplaza' },
    { name: 'Contact', href: '/contact' },
  ];

  const handleSelectAddressSuggestion = (suggestion: AddressSuggestion) => {
    setSelectedAddress(suggestion);
    setAddressQuery(suggestion.label);
    setPostalCode(suggestion.postalCode);
    setAddressSuggestions([]);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setAddressError('Location access is not supported in this browser.');
      return;
    }

    setIsLocatingAddress(true);
    setAddressError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${latitude}&lon=${longitude}`,
            { headers: { Accept: 'application/json' } }
          );

          if (!response.ok) {
            throw new Error('Reverse geocoding failed');
          }

          const result = (await response.json()) as {
            display_name: string;
            address?: {
              postcode?: string;
              house_number?: string;
              suburb?: string;
              neighbourhood?: string;
              city_district?: string;
              town?: string;
              village?: string;
              city?: string;
            };
          };

          const address = result.address ?? {};
          const areaName =
            address.suburb ||
            address.neighbourhood ||
            address.city_district ||
            address.town ||
            address.village ||
            address.city ||
            '';
          const shortLabel = [address.house_number, areaName].filter(Boolean).join(', ');

          const suggestion: AddressSuggestion = {
            id: `current-${latitude}-${longitude}`,
            label: shortLabel || result.display_name,
            postalCode: address.postcode ?? '',
            lat: latitude,
            lng: longitude,
          };

          handleSelectAddressSuggestion(suggestion);
        } catch {
          setAddressError('Could not detect your address. Please type it manually.');
        } finally {
          setIsLocatingAddress(false);
        }
      },
      () => {
        setIsLocatingAddress(false);
        setAddressError('Location access was denied. You can type the address manually instead.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQuery = searchQuery.trim();
    router.push(trimmedQuery ? `/mart?q=${encodeURIComponent(trimmedQuery)}` : '/mart');
  };

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white shadow-md'
          : 'bg-white/95 backdrop-blur-md'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-12 flex-wrap items-center justify-start gap-2 border-b border-gray-100 py-2 md:gap-3">
          <Link href="/" className="mr-2 flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-red-primary to-brand-red-secondary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="font-bold text-lg text-brand-dark">
              Mangwaoo
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setIsAddressModalOpen(true)}
            className="flex max-w-[220px] items-center gap-1.5 rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-brand-dark hover:border-brand-red-primary hover:text-brand-red-primary transition-colors"
          >
            <MapPin className="w-4 h-4 shrink-0 text-brand-red-primary" />
            <span className="truncate">
              {selectedAddress ? selectedAddress.label : 'Select your address'}
            </span>
          </button>

          <form
            onSubmit={handleSearchSubmit}
            className="order-last w-full md:order-none md:flex-1 md:max-w-md"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search for food, groceries, shops..."
                className="w-full rounded-full border border-gray-300 pl-9 pr-4 py-2 text-sm outline-none transition focus:border-brand-red-primary focus:ring-2 focus:ring-red-100"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/cart"
              className="relative rounded-full border border-gray-300 p-2.5 text-brand-dark hover:border-brand-red-primary hover:text-brand-red-primary transition-colors"
              aria-label="Open cart"
            >
              <ShoppingCart className="w-4 h-4" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-red-primary text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
            {isAuthLoading ? (
              <div className="h-9 w-24 animate-pulse rounded-full bg-gray-100" />
            ) : user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-full border border-gray-300 px-3 py-2 text-sm font-semibold text-brand-dark hover:border-brand-red-primary hover:text-brand-red-primary transition-colors"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-red-primary/10 text-xs font-bold text-brand-red-primary">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[100px] truncate">{user.name.split(' ')[0]}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-gray-100 bg-white py-1.5 shadow-lg">
                    <div className="px-4 py-2 border-b border-gray-50">
                      <p className="truncate text-sm font-semibold text-brand-dark">{user.name}</p>
                      <p className="text-xs text-brand-gray">
                        {user.role === 'SELLER' ? 'Seller account' : user.role === 'ADMIN' ? 'Admin account' : 'Customer account'}
                      </p>
                    </div>
                    {user.role === 'CUSTOMER' && (
                      <Link
                        href="/account"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-brand-dark hover:bg-brand-light"
                      >
                        <PackageSearch className="w-4 h-4" />
                        My Orders
                      </Link>
                    )}
                    {user.role === 'SELLER' && (
                      <Link
                        href="/seller"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-brand-dark hover:bg-brand-light"
                      >
                        <Store className="w-4 h-4" />
                        Seller Dashboard
                      </Link>
                    )}
                    {user.role === 'ADMIN' && (
                      <Link
                        href="/admin/sellers"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-brand-dark hover:bg-brand-light"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Seller Approvals
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        setIsUserMenuOpen(false);
                        await logout();
                        router.push('/');
                        router.refresh();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-brand-dark hover:bg-brand-light"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openSignIn}
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-brand-dark hover:border-brand-red-primary hover:text-brand-red-primary transition-colors"
                >
                  Login
                </button>
                <Link
                  href="/signup"
                  className="rounded-full border border-brand-red-primary px-4 py-2 text-sm font-semibold text-brand-red-primary hover:bg-brand-red-primary hover:text-white transition-colors"
                >
                  Sign up
                </Link>
              </>
            )}
            <Link
              href="/mart"
              className="flex items-center space-x-2 rounded-full bg-[#9b0000] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-red-200 hover:bg-[#840000] transition-all duration-300"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Order Now!</span>
            </Link>
          </div>
        </div>

        <div className="flex min-h-14 items-center justify-start">
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.slice(0, 4).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-brand-dark hover:text-brand-red-primary transition-colors font-medium"
              >
                {link.name}
              </Link>
            ))}

            <div className="relative" ref={servicesMenuRef}>
              <button
                type="button"
                onClick={() => setIsServicesMenuOpen((prev) => !prev)}
                className="flex items-center gap-1 text-brand-dark hover:text-brand-red-primary transition-colors font-medium"
              >
                Services
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isServicesMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isServicesMenuOpen && (
                <div className="absolute left-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-xl border border-gray-100 bg-white py-1.5 shadow-lg">
                  {PROFESSIONAL_SERVICES.map((service) => (
                    <Link
                      key={service.slug}
                      href={`/services-hub#${service.slug}`}
                      onClick={() => setIsServicesMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-brand-dark hover:bg-brand-light"
                    >
                      <span className="text-base leading-none">{service.icon}</span>
                      {service.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {navLinks.slice(4).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-brand-dark hover:text-brand-red-primary transition-colors font-medium"
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-brand-dark hover:text-brand-red-primary"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {isAddressModalOpen && createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-xs max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-3 shadow-2xl sm:max-w-sm sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-brand-red-primary">Delivery address</p>
                  <h3 className="mt-1 text-xl font-semibold text-brand-dark">Select your address</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="rounded-full border border-gray-200 p-2 text-brand-dark hover:bg-gray-100"
                  aria-label="Close address selector"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <label className="relative block text-xs text-brand-dark">
                  Address / Street
                  <input
                    type="text"
                    value={addressQuery}
                    onChange={(event) => {
                      setAddressQuery(event.target.value);
                      setSelectedAddress(null);
                    }}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-brand-red-primary focus:ring-2 focus:ring-red-100"
                    placeholder="Start typing your street or area"
                    autoComplete="off"
                  />

                  {isSearchingAddress && (
                    <p className="mt-1 text-xs text-brand-gray">Searching…</p>
                  )}

                  {addressSuggestions.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                      {addressSuggestions.map((suggestion) => (
                        <li key={suggestion.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectAddressSuggestion(suggestion)}
                            className="block w-full px-3 py-2 text-left text-xs text-brand-dark hover:bg-red-50"
                          >
                            {suggestion.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </label>

                <button
                  type="button"
                  onClick={handleLocateMe}
                  className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-2 text-xs font-semibold text-[#9b0000] hover:bg-red-100"
                >
                  <LocateFixed className="w-4 h-4" />
                  {isLocatingAddress ? 'Locating…' : 'Locate me'}
                </button>

                {addressError ? <p className="text-xs text-red-600">{addressError}</p> : null}

                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <iframe
                    title="Selected address map"
                    src={
                      selectedAddress
                        ? `https://www.openstreetmap.org/export/embed.html?bbox=${selectedAddress.lng - 0.01},${selectedAddress.lat - 0.01},${selectedAddress.lng + 0.01},${selectedAddress.lat + 0.01}&layer=mapnik&marker=${selectedAddress.lat},${selectedAddress.lng}`
                        : 'https://www.openstreetmap.org/export/embed.html?bbox=66.75,24.78,67.17,25.06&layer=mapnik'
                    }
                    className="h-40 w-full border-0"
                    loading="lazy"
                    allowFullScreen
                  />
                </div>

                <label className="block text-xs text-brand-dark">
                  Postal Code
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(event) => setPostalCode(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-brand-red-primary focus:ring-2 focus:ring-red-100"
                    placeholder="e.g. 75850"
                  />
                </label>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddressModalOpen(false)}
                    className="rounded-full border border-gray-300 px-3 py-2 text-sm font-semibold text-brand-dark hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!selectedAddress}
                    onClick={() => setIsAddressModalOpen(false)}
                    className="rounded-full bg-[#9b0000] px-3 py-2 text-sm font-semibold text-white shadow-md shadow-red-200 hover:bg-[#840000] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Confirm address
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        <SignInModal isOpen={isSignInOpen} onClose={closeSignIn} />

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden border-t border-gray-200 py-4 space-y-3">
            {navLinks.slice(0, 4).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-4 py-2 text-brand-dark hover:bg-brand-light rounded-lg transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {link.name}
              </Link>
            ))}

            <div>
              <p className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-gray">Services</p>
              {PROFESSIONAL_SERVICES.map((service) => (
                <Link
                  key={service.slug}
                  href={`/services-hub#${service.slug}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-6 py-2 text-brand-dark hover:bg-brand-light rounded-lg transition-colors"
                >
                  <span className="text-base leading-none">{service.icon}</span>
                  {service.name}
                </Link>
              ))}
            </div>

            {navLinks.slice(4).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-4 py-2 text-brand-dark hover:bg-brand-light rounded-lg transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {link.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
