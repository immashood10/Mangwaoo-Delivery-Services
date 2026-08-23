export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

export const formatPhoneNumber = (phone: string): string => {
  return phone.replace(/(\d{4})(\d{7})/, '$1-$2');
};

export const getServiceIcon = (iconName: string) => {
  const iconMap: { [key: string]: string } = {
    UtensilsCrossed: '🍽️',
    ShoppingCart: '🛒',
    Milk: '🥛',
    Pill: '💊',
    Zap: '⚡',
    CheckCircle: '✅',
    Clock: '🕐',
    Package: '📦',
    Smartphone: '📱',
    DollarSign: '💵',
    MapPin: '📍',
    Grid: '📊',
  };
  return iconMap[iconName] || '📦';
};

export const scrollToSection = (sectionId: string) => {
  if (typeof window !== 'undefined') {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
};
