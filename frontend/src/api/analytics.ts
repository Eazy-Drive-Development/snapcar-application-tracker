const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api';

type DailyRow = { day: string; count: number; totalAmount: number };
type DayWiseData = {
  date: string;
  totalBookings: number;
  totalUsers: number;
  totalVendors: number;
  totalRevenue: number;
  totalProfit: number;
  deletedUsers: number;
  deletedVendors: number;
};
type VendorPayout = {
  paymentId: number;
  bookingId: number | null;
  vendorId: number | null;
  userId: number | null;
  vendorName: string;
  vendorPhoneNumber: string | null;
  customerName: string;
  customerPhoneNumber: string | null;
  amount: number;
  totalAmount: number;
  bookingStatus: string;
  bookingStartDate: string | null;
  bookingEndDate: string | null;
  platformCharges: number;
  remainingAmount: number;
  paymentTrackerId: number | null;
  paymentPayto: number | null;
  paidAmount: number | null;
  profit: number | null;
  paymentNotes: string | null;
};
export type SubscriptionRow = {
  id: number;
  vendorId: number | null;
  vendorName: string;
  status: string;
  amount: number;
  startDate: string | null;
  endDate: string | null;
  createdOn: string | null;
};
export type VendorListingRow = {
  vendorId: number;
  vendorName: string;
  vendorPhoneNumber: string | null;
  carId: number | null;
  carRowStatus: number | null;
  vehicleNumber: string | null;
  carName: string | null;
  listingHistoryCount: number;
  activePauseListings: Array<{
    id: number;
    listingId: number | null;
    startDate: string | null;
    endDate: string | null;
  }>;
  listingId: number | null;
  listingStartDate: string | null;
  listingEndDate: string | null;
  listingStatus: 'Active' | 'Inactive';
  subscriptionId: number | null;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  subscriptionAmount: number | null;
  subscriptionStatusValue: string | null;
  subscriptionDateStatus: 'Active' | 'Inactive';
};
export type AccountSummary = {
  totalProfit: number;
  totalRemaining: number;
  totalSubscriptionAmount: number;
  moneyAdded: number;
  total: number;
  expense: number;
  overallTotal: number;
  transactions: AccountTransaction[];
};
export type AccountTransactionType = 'MONEY_ADDED' | 'EXPENSE';
export type AccountTransaction = {
  id: number;
  transactionType: AccountTransactionType;
  amount: number;
  notes: string | null;
  transactionDate: string | null;
  createdOn: string | null;
};
type CreateAccountTransactionPayload = {
  transactionType: AccountTransactionType;
  amount: number;
  notes: string;
  transactionDate: string;
};
type CreatePaymentTrackerPayload = {
  paymentId: number;
  carBookingId: number;
  payto: number | null;
  amountPaid: number;
  notes: string;
};

const fetchJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${apiBase}${path}`);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
};

const postJson = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = errorBody && typeof errorBody.error === 'string'
      ? errorBody.error
      : response.statusText;
    throw new Error(`API request failed: ${message}`);
  }

  return response.json();
};

const patchJson = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = errorBody && typeof errorBody.error === 'string'
      ? errorBody.error
      : response.statusText;
    throw new Error(`API request failed: ${message}`);
  }

  return response.json();
};

const deleteJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = errorBody && typeof errorBody.error === 'string'
      ? errorBody.error
      : response.statusText;
    throw new Error(`API request failed: ${message}`);
  }

  return response.json();
};

export const getDailyBookings = async (days = 14) => fetchJson<{ days: number; data: DailyRow[] }>(`/analytics/daily-bookings?days=${days}`);
export const getDailyEarnings = async (days = 14) => fetchJson<{ days: number; data: DailyRow[] }>(`/analytics/daily-earnings?days=${days}`);
export const getDayWiseAnalytics = async (fromDate: string, toDate: string) => fetchJson<DayWiseData[]>(`/analytics/day-wise-analytics?fromDate=${fromDate}&toDate=${toDate}`);
export const getPendingPayments = async () => fetchJson<{ data: VendorPayout[] }>(`/analytics/pending-payments`);
export const getSubscriptions = async () => fetchJson<{ data: SubscriptionRow[] }>(`/analytics/subscriptions`);
export const getVendorListings = async () => fetchJson<{ data: VendorListingRow[] }>(`/analytics/vendor-listings`);
export const getAccountSummary = async () => fetchJson<AccountSummary>(`/analytics/account-summary`);
export const createAccountTransaction = async (payload: CreateAccountTransactionPayload) => postJson<{ id: number }>(`/analytics/account-transactions`, payload);
export const deleteAccountTransaction = async (id: number) => deleteJson<{ deleted: boolean; id: number }>(`/analytics/account-transactions/${id}`);
export const createPaymentTracker = async (payload: CreatePaymentTrackerPayload) => postJson<{ id: number; amountPaid: number; profit: number; notes: string }>(`/analytics/payment-tracker`, payload);
export const updateVendorListingEndDate = async (listingId: number, endDate: string) => (
  patchJson<{ id: number; endDate: string }>(`/analytics/vendor-listings/${listingId}/end-date`, { endDate })
);
export const updateSubscriptionEndDate = async (subscriptionId: number, endDate: string) => (
  patchJson<{ id: number; endDate: string }>(`/analytics/subscriptions/${subscriptionId}/end-date`, { endDate })
);
export const getSummary = async () => fetchJson<{
  totalBookings: number;
  totalCustomers: number;
  totalVendors: number;
  totalDeletedCustomers: number;
  totalDeletedVendors: number;
  grossEarnings: number;
  pendingAmount: number;
}>(`/analytics/summary`);
