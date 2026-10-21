'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X, MapPin, LocateFixed, Search, ShoppingCart, ChevronDown, Store, LogOut, ShieldCheck, PackageSearch, House, Briefcase, Heart, Trash2, Bike, MessagesSquare, LayoutDashboard, Settings, type LucideIcon } from 'lucide-react';
import { PROFESSIONAL_SERVICES } from '@/lib/data';
import {
  ADDRESS_TAGS,
  MAX_ADDRESS_LABEL_LENGTH,
  deleteSavedAddress,
  fetchSavedAddresses,
  getAddressTag,
  isSameSpot,
  onSavedAddressRemoved,
  saveAddress,
  type AddressTag,
  type SavedAddress,
} from '@/lib/saved-addresses';
import { LocationError, detectCurrentLocation, fetchVisitorState, saveVisitorState } from '@/lib/current-location';
import SignInModal from './SignInModal';
import LocationPrompt from './LocationPrompt';
import OrderChat from './OrderChat';
import StoryLogo from './StoryLogo';
import type { PickedLocation } from './LocationPicker';
import { useCart } from '@/lib/cart-context';
import { useAuth } from '@/lib/auth-context';
import { useDeliveryAddress, type DeliveryAddress } from '@/lib/delivery-address-context';

type AddressSuggestion = DeliveryAddress;

const ADDRESS_TAG_ICONS: Record<AddressTag, LucideIcon> = {
  Home: House,
  Office: Briefcase,
  Partner: Heart,
  Other: MapPin,
};

// Sign-in and sign-up screens: don't ask for the location on top of them.
const AUTH_PAGE_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password', '/sell'];

function savedToSuggestion(address: SavedAddress): AddressSuggestion {
  return {
    id: address.id,
    label: address.street,
    postalCode: '',
    lat: address.lat,
    lng: address.lng,
    savedAs: address.label,
  };
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressQuery, setAddressQuery] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [isLocatingAddress, setIsLocatingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');
  const { address: selectedAddress, setAddress: setSelectedAddress } = useDeliveryAddress();

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressStep, setAddressStep] = useState<'pick' | 'save'>('pick');
  const [saveTag, setSaveTag] = useState<AddressTag>('Home');
  const [customAddressLabel, setCustomAddressLabel] = useState('');
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [saveAddressError, setSaveAddressError] = useState('');

  const [isOrderChatOpen, setIsOrderChatOpen] = useState(false);
  const [orderPickup, setOrderPickup] = useState<PickedLocation | null>(null);
  // Set when the order chat sent the user to pick an address, so it reopens afterwards.
  const [resumeOrderChat, setResumeOrderChat] = useState(false);

  // First visit: no address is known yet and the visitor was never asked, so offer to use their location.
  const [wantsLocationPrompt, setWantsLocationPrompt] = useState(false);
  const [isPromptLocating, setIsPromptLocating] = useState(false);
  const [promptError, setPromptError] = useState('');

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [isServicesMenuOpen, setIsServicesMenuOpen] = useState(false);
  const servicesMenuRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const { cartCount } = useCart();
  const { user, isLoading: isAuthLoading, logout, isSignInOpen, openSignIn, closeSignIn } = useAuth();
  const isLoggedIn = Boolean(user);
  // Only shoppers are asked: sellers and admins don't order for delivery.
  const canAskLocation = !user || user.role === 'CUSTOMER';

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    let isMounted = true;

    // Saved addresses belong to a logged-in account; what a visitor last shared, and whether they were
    // already asked, is kept for the browser as a whole. Both come from the database.
    Promise.all([isLoggedIn ? fetchSavedAddresses() : Promise.resolve<SavedAddress[]>([]), fetchVisitorState().catch(() => null)])
      .then(([addresses, visitor]) => {
        if (!isMounted) return;
        setSavedAddresses(addresses);
        // Start from the most recently saved address (or the spot they last shared) so returning visitors don't have to pick again.
        const remembered = addresses[0] ? savedToSuggestion(addresses[0]) : (visitor?.location ?? null);
        setSelectedAddress((current) => current ?? remembered);

        if (!remembered && visitor && !visitor.prompted && canAskLocation) {
          setWantsLocationPrompt(true);
        }
      })
      .catch(() => {
        if (isMounted) setSavedAddresses([]);
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, isLoggedIn, canAskLocation, setSelectedAddress]);

  const showLocationPrompt =
    wantsLocationPrompt &&
    !selectedAddress &&
    !isSignInOpen &&
    !isOrderChatOpen &&
    !isAddressModalOpen &&
    !AUTH_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  // An address removed from Settings must also leave this picker (the navbar stays mounted across pages).
  useEffect(
    () =>
      onSavedAddressRemoved((id) => {
        setSavedAddresses((prev) => prev.filter((address) => address.id !== id));
        setSelectedAddress((current) => (current?.id === id ? { ...current, savedAs: undefined } : current));
      }),
    [setSelectedAddress]
  );

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isAddressModalOpen && !isSignInOpen && !isOrderChatOpen && !showLocationPrompt) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAddressModalOpen, isSignInOpen, isOrderChatOpen, showLocationPrompt]);

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

  const openAddressModal = () => {
    setAddressStep('pick');
    setSaveAddressError('');
    setIsAddressModalOpen(true);
  };

  const closeAddressModal = (addressConfirmed = false) => {
    setIsAddressModalOpen(false);
    setAddressStep('pick');

    if (resumeOrderChat) {
      setResumeOrderChat(false);
      if (addressConfirmed) setIsOrderChatOpen(true);
    }
  };

  const handleOrderNow = () => {
    if (isAuthLoading) return;

    if (!user) {
      openSignIn();
      return;
    }

    setIsOrderChatOpen(true);
  };

  const handleOrderChatNeedsAddress = () => {
    setIsOrderChatOpen(false);
    setResumeOrderChat(true);
    openAddressModal();
  };

  const handleConfirmAddress = () => {
    if (!selectedAddress) {
      return;
    }

    // The confirmed spot is remembered for this browser (in the database).
    void saveVisitorState({ location: selectedAddress });

    // Saving a place as Home/Office needs an account; a guest just uses the address.
    if (!isLoggedIn) {
      closeAddressModal(true);
      return;
    }

    const alreadySaved =
      selectedAddress.savedAs !== undefined
        ? savedAddresses.find((address) => address.id === selectedAddress.id)
        : savedAddresses.find((address) => isSameSpot(address, selectedAddress));

    if (alreadySaved) {
      setSelectedAddress({ ...selectedAddress, savedAs: alreadySaved.label });
      closeAddressModal(true);
      return;
    }

    // First time this location is used — offer to save it.
    setSaveTag('Home');
    setCustomAddressLabel('');
    setSaveAddressError('');
    setAddressStep('save');
  };

  const handleSaveAddress = async () => {
    if (!selectedAddress) {
      return;
    }

    const label = saveTag === 'Other' ? customAddressLabel.trim() || 'Other' : saveTag;

    setIsSavingAddress(true);
    setSaveAddressError('');

    try {
      const saved = await saveAddress({
        label,
        street: selectedAddress.label,
        lat: selectedAddress.lat,
        lng: selectedAddress.lng,
      });

      setSavedAddresses((prev) => [saved, ...prev]);
      setSelectedAddress({ ...selectedAddress, id: saved.id, savedAs: saved.label });
      closeAddressModal(true);
    } catch (error) {
      setSaveAddressError((error as Error).message || 'Could not save address. Please try again.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteSavedAddress = async (id: string) => {
    try {
      await deleteSavedAddress(id);
      setSavedAddresses((prev) => prev.filter((address) => address.id !== id));
      setSelectedAddress((current) =>
        current?.id === id ? { ...current, savedAs: undefined } : current
      );
    } catch {
      setAddressError('Could not remove that address. Please try again.');
    }
  };

  const handleLocateMe = async () => {
    setIsLocatingAddress(true);
    setAddressError('');

    try {
      handleSelectAddressSuggestion(await detectCurrentLocation());
    } catch (error) {
      setAddressError(error instanceof LocationError ? error.message : 'Could not detect your address. Please type it manually.');
    } finally {
      setIsLocatingAddress(false);
    }
  };

  // The visitor has answered the first-visit location question (in any way), so it isn't asked again.
  const finishLocationPrompt = (location?: AddressSuggestion) => {
    void saveVisitorState({ prompted: true, ...(location ? { location } : {}) });
    setWantsLocationPrompt(false);
    setPromptError('');
  };

  const handlePromptUseLocation = async () => {
    setIsPromptLocating(true);
    setPromptError('');

    try {
      const location = await detectCurrentLocation();
      setSelectedAddress(location);
      finishLocationPrompt(location);
    } catch (error) {
      setPromptError(
        error instanceof LocationError ? error.message : 'Could not detect your location. Please type your address instead.'
      );
    } finally {
      setIsPromptLocating(false);
    }
  };

  const handlePromptEnterManually = () => {
    finishLocationPrompt();
    openAddressModal();
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      router.push('/gulplaza');
      return;
    }

    // Send the delivery address along so restaurants are listed nearest first.
    const params = new URLSearchParams({ q: trimmedQuery });
    if (selectedAddress && (selectedAddress.lat !== 0 || selectedAddress.lng !== 0)) {
      params.set('lat', String(selectedAddress.lat));
      params.set('lng', String(selectedAddress.lng));
    }
    router.push(`/search?${params}`);
  };

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-surface shadow-md'
          : 'bg-surface/95 backdrop-blur-md'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-12 flex-wrap items-center justify-start gap-2 border-b border-gray-100 py-2 md:gap-3">
          <StoryLogo />

          <button
            type="button"
            onClick={openAddressModal}
            className="flex max-w-[220px] items-center gap-1.5 rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-ink hover:border-accent hover:text-accent transition-colors"
          >
            <MapPin className="w-4 h-4 shrink-0 text-accent" />
            <span className="truncate">
              {selectedAddress ? (
                <>
                  {selectedAddress.savedAs && (
                    <span className="font-semibold">{selectedAddress.savedAs} · </span>
                  )}
                  {selectedAddress.label}
                </>
              ) : (
                'Select your address'
              )}
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
                className="w-full rounded-full border border-gray-300 pl-9 pr-4 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
              />
            </div>
          </form>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/favourites"
              className={`rounded-full border p-2.5 transition-colors hover:border-accent hover:text-accent ${
                pathname === '/favourites' ? 'border-accent text-accent' : 'border-gray-300 text-ink'
              }`}
              aria-label="Open favourites"
              title="Favourites"
            >
              <Heart className={`w-4 h-4 ${pathname === '/favourites' ? 'fill-current' : ''}`} />
            </Link>
            <Link
              href="/cart"
              className="relative rounded-full border border-gray-300 p-2.5 text-ink hover:border-accent hover:text-accent transition-colors"
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
                  className="flex items-center gap-2 rounded-full border border-gray-300 px-3 py-2 text-sm font-semibold text-ink hover:border-accent hover:text-accent transition-colors"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-red-primary/10 text-xs font-bold text-accent">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[100px] truncate">{user.name.split(' ')[0]}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-gray-100 bg-surface py-1.5 shadow-lg">
                    <div className="px-4 py-2 border-b border-gray-50">
                      <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                      <p className="text-xs text-brand-gray">
                        {user.role === 'SELLER'
                          ? 'Seller account'
                          : user.role === 'ADMIN'
                            ? 'Admin account'
                            : user.role === 'RIDER'
                              ? 'Rider account'
                              : 'Customer account'}
                      </p>
                    </div>
                    {user.role === 'CUSTOMER' && (
                      <>
                        <Link
                          href="/account"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-brand-light"
                        >
                          <PackageSearch className="w-4 h-4" />
                          My Orders
                        </Link>
                        <Link
                          href="/favourites"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-brand-light"
                        >
                          <Heart className="w-4 h-4" />
                          Favourites
                        </Link>
                        <Link
                          href="/account/settings"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-brand-light"
                        >
                          <Settings className="w-4 h-4" />
                          Settings
                        </Link>
                      </>
                    )}
                    {user.role === 'SELLER' && (
                      <Link
                        href="/seller"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-brand-light"
                      >
                        <Store className="w-4 h-4" />
                        Seller Dashboard
                      </Link>
                    )}
                    {user.role === 'RIDER' && (
                      <Link
                        href="/rider"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-brand-light"
                      >
                        <Bike className="w-4 h-4" />
                        Rider Dashboard
                      </Link>
                    )}
                    {user.role === 'ADMIN' && (
                      <>
                        <Link
                          href="/admin"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-light"
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          Admin Dashboard
                        </Link>
                        <Link
                          href="/admin/sellers"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-brand-light"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Seller Approvals
                        </Link>
                        <Link
                          href="/admin/rider-chats"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-brand-light"
                        >
                          <MessagesSquare className="w-4 h-4" />
                          Order Chats
                        </Link>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        setIsUserMenuOpen(false);
                        await logout();
                        router.push('/');
                        router.refresh();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink hover:bg-brand-light"
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
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-ink hover:border-accent hover:text-accent transition-colors"
                >
                  Login
                </button>
                <Link
                  href="/signup"
                  className="rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-brand-red-primary hover:text-white transition-colors"
                >
                  Sign up
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={handleOrderNow}
              className="flex items-center space-x-2 whitespace-nowrap rounded-full bg-[#9b0000] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-red-200 hover:bg-[#840000] transition-all duration-300"
            >
              <MessagesSquare className="w-4 h-4" />
              <span>Chat with Rider</span>
            </button>
          </div>
        </div>

        <div className="flex min-h-14 items-center justify-start">
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.slice(0, 4).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-ink hover:text-accent transition-colors font-medium"
              >
                {link.name}
              </Link>
            ))}

            <div className="relative" ref={servicesMenuRef}>
              <button
                type="button"
                onClick={() => setIsServicesMenuOpen((prev) => !prev)}
                className="flex items-center gap-1 text-ink hover:text-accent transition-colors font-medium"
              >
                Services
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isServicesMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isServicesMenuOpen && (
                <div className="absolute left-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-xl border border-gray-100 bg-surface py-1.5 shadow-lg">
                  {PROFESSIONAL_SERVICES.map((service) => (
                    <Link
                      key={service.slug}
                      href={`/services-hub#${service.slug}`}
                      onClick={() => setIsServicesMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink hover:bg-brand-light"
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
                className="text-ink hover:text-accent transition-colors font-medium"
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-ink hover:text-accent"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {isAddressModalOpen && createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-xs max-h-[90vh] overflow-y-auto rounded-2xl bg-surface p-3 shadow-2xl sm:max-w-sm sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-accent">Delivery address</p>
                  <h3 className="mt-1 text-xl font-semibold text-ink">
                    {addressStep === 'save' ? 'Save this location?' : 'Select your address'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => closeAddressModal()}
                  className="rounded-full border border-gray-200 p-2 text-ink hover:bg-gray-100"
                  aria-label="Close address selector"
                >
                  <X size={18} />
                </button>
              </div>

              {addressStep === 'save' && selectedAddress ? (
                <div className="mt-4 space-y-4">
                  <div className="flex items-start gap-2 rounded-xl bg-brand-light p-3 text-xs text-ink">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <p className="line-clamp-3">{selectedAddress.label}</p>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-ink">Where is this place?</p>
                    <div className="grid grid-cols-4 gap-2">
                      {ADDRESS_TAGS.map((tag) => {
                        const TagIcon = ADDRESS_TAG_ICONS[tag.value];
                        const isActive = saveTag === tag.value;

                        return (
                          <button
                            key={tag.value}
                            type="button"
                            onClick={() => setSaveTag(tag.value)}
                            aria-pressed={isActive}
                            className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-xs font-semibold transition ${
                              isActive
                                ? 'border-accent bg-red-50 text-accent'
                                : 'border-gray-200 text-ink hover:border-accent/50'
                            }`}
                          >
                            <TagIcon className="h-5 w-5" />
                            {tag.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {saveTag === 'Other' && (
                    <label className="block text-xs text-ink">
                      Name this place
                      <input
                        type="text"
                        value={customAddressLabel}
                        onChange={(event) => setCustomAddressLabel(event.target.value)}
                        maxLength={MAX_ADDRESS_LABEL_LENGTH}
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                        placeholder="e.g. Gym, Ammi's house"
                        autoFocus
                      />
                    </label>
                  )}

                  {saveAddressError ? <p className="text-xs text-danger">{saveAddressError}</p> : null}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => closeAddressModal(true)}
                      className="rounded-full border border-gray-300 px-3 py-2 text-sm font-semibold text-ink hover:bg-gray-100"
                    >
                      Not now
                    </button>
                    <button
                      type="button"
                      disabled={isSavingAddress}
                      onClick={handleSaveAddress}
                      className="rounded-full bg-[#9b0000] px-3 py-2 text-sm font-semibold text-white shadow-md shadow-red-200 hover:bg-[#840000] disabled:cursor-wait disabled:opacity-60"
                    >
                      {isSavingAddress ? 'Saving…' : 'Save address'}
                    </button>
                  </div>
                </div>
              ) : (
              <div className="mt-4 space-y-3">
                {savedAddresses.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-brand-gray">Saved addresses</p>
                    <ul className="space-y-1.5">
                      {savedAddresses.map((address) => {
                        const TagIcon = ADDRESS_TAG_ICONS[getAddressTag(address.label)];
                        const isSelected = selectedAddress?.id === address.id;

                        return (
                          <li key={address.id} className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleSelectAddressSuggestion(savedToSuggestion(address))}
                              className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition ${
                                isSelected
                                  ? 'border-accent bg-red-50'
                                  : 'border-gray-200 hover:border-accent/50'
                              }`}
                            >
                              <TagIcon className="h-4 w-4 shrink-0 text-accent" />
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-ink">{address.label}</span>
                                <span className="block truncate text-xs text-brand-gray">{address.street}</span>
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSavedAddress(address.id)}
                              className="rounded-full p-2 text-brand-gray hover:bg-gray-100 hover:text-danger"
                              aria-label={`Remove saved address ${address.label}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <label className="relative block text-xs text-ink">
                  Address / Street
                  <input
                    type="text"
                    value={addressQuery}
                    onChange={(event) => {
                      setAddressQuery(event.target.value);
                      setSelectedAddress(null);
                    }}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                    placeholder="Start typing your street or area"
                    autoComplete="off"
                  />

                  {isSearchingAddress && (
                    <p className="mt-1 text-xs text-brand-gray">Searching…</p>
                  )}

                  {addressSuggestions.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-surface shadow-lg">
                      {addressSuggestions.map((suggestion) => (
                        <li key={suggestion.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectAddressSuggestion(suggestion)}
                            className="block w-full px-3 py-2 text-left text-xs text-ink hover:bg-red-50"
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
                  className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-2 text-xs font-semibold text-accent hover:bg-red-100"
                >
                  <LocateFixed className="w-4 h-4" />
                  {isLocatingAddress ? 'Locating…' : 'Locate me'}
                </button>

                {addressError ? <p className="text-xs text-danger">{addressError}</p> : null}

                <div className="relative overflow-hidden rounded-xl border border-gray-200">
                  <iframe
                    key={selectedAddress ? selectedAddress.id : 'karachi'}
                    title="Selected address map"
                    src={
                      selectedAddress
                        ? `https://maps.google.com/maps?q=${selectedAddress.lat},${selectedAddress.lng}&z=17&hl=en&output=embed`
                        : 'https://maps.google.com/maps?q=Karachi,Pakistan&z=11&hl=en&output=embed'
                    }
                    className="h-56 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                  <button
                    type="button"
                    onClick={handleLocateMe}
                    disabled={isLocatingAddress}
                    className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-gray-600 shadow-md ring-1 ring-black/5 transition hover:text-[#1a73e8] disabled:cursor-wait"
                    aria-label="Show my location"
                    title="Show my location"
                  >
                    <LocateFixed className={`h-5 w-5 ${isLocatingAddress ? 'animate-pulse text-[#1a73e8]' : ''}`} />
                  </button>
                </div>

                <label className="block text-xs text-ink">
                  Postal Code
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(event) => setPostalCode(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                    placeholder="e.g. 75850"
                  />
                </label>

                {!isLoggedIn && (
                  <p className="text-xs text-brand-gray">Log in to save places like Home and Office to your account.</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => closeAddressModal()}
                    className="rounded-full border border-gray-300 px-3 py-2 text-sm font-semibold text-ink hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!selectedAddress}
                    onClick={handleConfirmAddress}
                    className="rounded-full bg-[#9b0000] px-3 py-2 text-sm font-semibold text-white shadow-md shadow-red-200 hover:bg-[#840000] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Confirm address
                  </button>
                </div>
              </div>
              )}
            </div>
          </div>,
          document.body
        )}

        <SignInModal isOpen={isSignInOpen} onClose={closeSignIn} />

        {showLocationPrompt && (
          <LocationPrompt
            isLocating={isPromptLocating}
            error={promptError}
            onUseCurrentLocation={handlePromptUseLocation}
            onChooseManually={handlePromptEnterManually}
            onDismiss={() => finishLocationPrompt()}
          />
        )}

        {isOrderChatOpen && (
          <OrderChat
            onClose={() => setIsOrderChatOpen(false)}
            address={selectedAddress}
            onRequestAddress={handleOrderChatNeedsAddress}
            pickup={orderPickup}
            onPickupChange={setOrderPickup}
          />
        )}

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden border-t border-gray-200 py-4 space-y-3">
            {navLinks.slice(0, 4).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-4 py-2 text-ink hover:bg-brand-light rounded-lg transition-colors"
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
                  className="flex items-center gap-2.5 px-6 py-2 text-ink hover:bg-brand-light rounded-lg transition-colors"
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
                className="block px-4 py-2 text-ink hover:bg-brand-light rounded-lg transition-colors"
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
