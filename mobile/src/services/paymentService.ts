import { NativeModules } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { getApiBaseUrl } from '../config/api';

/**
 * Checks whether the native Razorpay Android/iOS binary is linked (available in bare/EAS builds).
 * Returns false when running in standard Expo Go on physical devices.
 */
export function isNativeRazorpayAvailable(): boolean {
  return !!(NativeModules && NativeModules.RNRazorpayCheckout);
}

export interface CreateOrderParams {
  booking_id?: string;
  spot_id?: string;
  driver_id?: string;
  amount: number;
  hours?: number;
}

export interface CreateOrderResponse {
  success: boolean;
  order_id?: string;
  amount?: number; // in paise
  currency?: string;
  key_id?: string;
  booking_id?: string;
  error?: string;
}

export interface RazorpayPaymentSuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentParams {
  booking_id?: string;
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  card_number?: string;
  expiry?: string;
  cvv?: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  booking?: any;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  route_split?: any;
  error?: string;
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number; // in paise
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    email?: string;
    contact?: string;
    name?: string;
  };
  theme?: {
    color?: string;
  };
  image?: string;
  [key: string]: any;
}

/**
 * Step 1: Create a Razorpay Order via Express Gateway
 */
export async function createPaymentOrder(
  params: CreateOrderParams,
  token?: string | null
): Promise<CreateOrderResponse> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/payments/create-order`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-client': 'ghost-parking-mobile',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    return {
      success: false,
      error: data.error || `Failed to create payment order (Status ${response.status})`,
    };
  }

  return {
    success: true,
    order_id: data.order_id,
    amount: data.amount,
    currency: data.currency || 'INR',
    key_id: data.key_id,
    booking_id: data.booking_id,
  };
}

/**
 * Step 2: Open Razorpay Native Checkout Modal via react-native-razorpay SDK
 * Strictly invokes RazorpayCheckout.open(options) and awaits user interaction
 * with the native Razorpay test UI. Rejects with 'NATIVE_RAZORPAY_UNAVAILABLE'
 * in environments like Expo Go where the native module is unlinked.
 */
export function openRazorpayCheckout(
  options: RazorpayCheckoutOptions
): Promise<RazorpayPaymentSuccess> {
  return new Promise((resolve, reject) => {
    if (!isNativeRazorpayAvailable()) {
      reject(new Error('NATIVE_RAZORPAY_UNAVAILABLE'));
      return;
    }
    RazorpayCheckout.open(options)
      .then((data: any) => {
        if (!data || !data.razorpay_payment_id) {
          reject(new Error('Invalid payment response from Razorpay'));
          return;
        }
        resolve({
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_order_id: data.razorpay_order_id || options.order_id,
          razorpay_signature: data.razorpay_signature,
        });
      })
      .catch((error: any) => {
        const errorMsg =
          error?.description ||
          error?.error?.description ||
          error?.message ||
          'Payment cancelled by user';
        reject(new Error(errorMsg));
      });
  });
}

export interface ProcessTestCardParams {
  order_id: string;
  card_number?: string;
  expiry?: string;
  cvv?: string;
}

export interface ProcessTestCardResponse {
  success: boolean;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  error?: string;
}

/**
 * Step 2b: Process manual test card credentials on Express Gateway for Expo Go sessions.
 * Returns genuine Razorpay cryptographic signature signed with RAZORPAY_KEY_SECRET.
 */
export async function processTestCardPayment(
  params: ProcessTestCardParams,
  token?: string | null
): Promise<ProcessTestCardResponse> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/payments/process-test-card`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-client': 'ghost-parking-mobile',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    return {
      success: false,
      error: data.error || `Test payment processing failed (Status ${response.status})`,
    };
  }

  return {
    success: true,
    razorpay_payment_id: data.razorpay_payment_id,
    razorpay_order_id: data.razorpay_order_id,
    razorpay_signature: data.razorpay_signature,
  };
}

/**
 * Step 3: Verify Payment Callback with Express Gateway and transition booking to 'active'
 */
export async function verifyPayment(
  params: VerifyPaymentParams,
  token?: string | null
): Promise<VerifyPaymentResponse> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/payments/verify`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-client': 'ghost-parking-mobile',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      success: false,
      error: data.error || `Payment verification failed (Status ${response.status})`,
    };
  }

  return {
    success: true,
    booking: data.booking,
    razorpay_payment_id: data.razorpay_payment_id,
    razorpay_order_id: data.razorpay_order_id,
    razorpay_signature: data.razorpay_signature,
    route_split: data.route_split,
  };
}

export interface HostTransactionItem {
  id: string;
  booking_id: string;
  spot_id: string;
  spot_title: string;
  spot_address: string;
  driver_name: string;
  driver_email: string;
  gross_amount: number;
  host_net_earnings: number;
  platform_fee: number;
  status: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  start_time?: string;
  end_time?: string;
  created_at?: string;
}

export interface HostEarningsResponse {
  success: boolean;
  host_id?: string;
  total_net_earnings: number;
  total_gross_earnings: number;
  platform_fee_deducted: number;
  active_bookings_count: number;
  completed_bookings_count: number;
  total_qualifying_bookings: number;
  split_rule?: {
    host_percentage: number;
    platform_fee_percentage: number;
  };
  recent_transactions: HostTransactionItem[];
  error?: string;
}

/**
 * Step 4: Fetch Host's Aggregated Net Earnings & Recent Transactions from Express Gateway
 */
export async function fetchHostEarnings(token?: string | null): Promise<HostEarningsResponse> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/host/earnings`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-client': 'ghost-parking-mobile',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    return {
      success: false,
      total_net_earnings: 0,
      total_gross_earnings: 0,
      platform_fee_deducted: 0,
      active_bookings_count: 0,
      completed_bookings_count: 0,
      total_qualifying_bookings: 0,
      recent_transactions: [],
      error: data.error || `Failed to fetch host earnings (Status ${response.status})`,
    };
  }

  return data;
}


