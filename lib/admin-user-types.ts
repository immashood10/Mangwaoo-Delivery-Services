// What the admin "Users" screens share between the server page and the browser. No database code in here.

export const FOOD_SELLER_TYPES = ['GULPLAZA_OWNER', 'WHOLESALER'] as const;

export const USER_VIEWS = ['customers', 'riders', 'riders-online', 'riders-pending', 'sellers', 'sellers-pending', 'banned'] as const;
export type UserView = (typeof USER_VIEWS)[number];

export const USER_LIST_LIMIT = 200;
export const MAX_USER_SEARCH_LENGTH = 80;

export function parseUserView(value: string | undefined): UserView {
  return USER_VIEWS.find((view) => view === value) ?? 'customers';
}

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'CUSTOMER' | 'SELLER' | 'RIDER';
  createdAt: string;
  /** Sellers: the store, its kind and whether it is approved. */
  seller: { businessName: string; isFood: boolean; isApproved: boolean; city: string | null } | null;
  /** Riders: the vehicle and whether they are approved / online right now. */
  rider: { vehicleType: string | null; isApproved: boolean; isOnline: boolean } | null;
  /** Customers: how many orders they have placed. */
  orderCount: number | null;
  /** The ban in force, if any. */
  ban: { permanent: boolean; durationLabel: string; endsAt: string | null; reason: string | null; startedAt: string } | null;
};

export type AdminUserCounts = { customers: number; riders: number; sellers: number; banned: number };
