import {
  createPaymentOrder,
  openRazorpayCheckout,
  verifyPayment,
  processTestCardPayment,
  isNativeRazorpayAvailable,
  fetchHostEarnings,
} from '../../src/services/paymentService';

describe('Unit Test Suite: paymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentOrder', () => {
    it('sends POST /payments/create-order and returns order details on success', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          order_id: 'order_test_999',
          amount: 24000,
          currency: 'INR',
          key_id: 'rzp_test_key',
          booking_id: 'booking_uuid_123',
        }),
      });

      const res = await createPaymentOrder(
        {
          spot_id: 'spot-uuid-1',
          driver_id: 'driver-uuid-1',
          amount: 240,
          hours: 2,
        },
        'mock-jwt-token'
      );

      expect(res.success).toBe(true);
      expect(res.order_id).toBe('order_test_999');
      expect(res.amount).toBe(24000);
      expect(res.booking_id).toBe('booking_uuid_123');

      expect((globalThis as any).fetch).toHaveBeenCalledWith(
        expect.stringContaining('/payments/create-order'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token',
          }),
        })
      );
    });

    it('returns error if gateway responds with failure', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'Spot not available',
        }),
      });

      const res = await createPaymentOrder({ amount: 100 });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Spot not available');
    });
  });

  describe('openRazorpayCheckout', () => {
    it('invokes native Razorpay modal and resolves with payment ID, order ID, and cryptographic signature', async () => {
      const checkoutRes = await openRazorpayCheckout({
        key: 'rzp_test_key',
        amount: 24000,
        currency: 'INR',
        name: 'Ghost Parking',
        description: 'Test Parking',
        order_id: 'order_test_999',
        prefill: {
          email: 'driver@test.com',
          contact: '+91 9999999999',
          name: 'Driver',
        },
      });

      expect(checkoutRes.razorpay_order_id).toBe('order_test_999');
      expect(checkoutRes.razorpay_payment_id).toBe('pay_test_rzp_mock_123');
      expect(checkoutRes.razorpay_signature).toBe('test_cryptographic_signature_mock');
    });

    it('rejects with error when user cancels or payment fails', async () => {
      const RazorpayCheckout = require('react-native-razorpay');
      const originalOpen = RazorpayCheckout.open;
      RazorpayCheckout.open = jest.fn().mockRejectedValue({
        description: 'Payment cancelled by user',
      });

      await expect(
        openRazorpayCheckout({
          key: 'rzp_test_key',
          amount: 24000,
          currency: 'INR',
          name: 'Ghost Parking',
          description: 'Test Parking',
          order_id: 'order_test_999',
        })
      ).rejects.toThrow('Payment cancelled by user');

      RazorpayCheckout.open = originalOpen;
    });
  });

  describe('processTestCardPayment', () => {
    it('sends POST /payments/process-test-card and returns payment ID and cryptographic signature', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          razorpay_payment_id: 'pay_test_genuine_123',
          razorpay_order_id: 'order_test_999',
          razorpay_signature: 'genuine_hmac_sha256_sig',
        }),
      });

      const res = await processTestCardPayment({
        order_id: 'order_test_999',
        card_number: '4000 0000 0000 0002',
        expiry: '12/30',
        cvv: '123',
      });

      expect(res.success).toBe(true);
      expect(res.razorpay_payment_id).toBe('pay_test_genuine_123');
      expect(res.razorpay_signature).toBe('genuine_hmac_sha256_sig');
    });

    it('returns error if test card processing fails', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'Invalid test card length',
        }),
      });

      const res = await processTestCardPayment({
        order_id: 'order_test_999',
        card_number: '123',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid test card length');
    });
  });

  describe('verifyPayment', () => {
    it('sends POST /payments/verify and returns active booking upon valid signature', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          booking: {
            id: 'bk_123',
            status: 'active',
            razorpay_payment_id: 'pay_999',
          },
          route_split: {
            total_amount: 240,
            host_net_earnings_80_percent: 192,
            platform_fee_20_percent: 48,
          },
        }),
      });

      const res = await verifyPayment(
        {
          booking_id: 'bk_123',
          razorpay_order_id: 'order_999',
          razorpay_payment_id: 'pay_999',
          razorpay_signature: 'sig_valid',
        },
        'token-123'
      );

      expect(res.success).toBe(true);
      expect(res.booking.status).toBe('active');
    });
  });

  describe('fetchHostEarnings', () => {
    it('sends GET /host/earnings and returns aggregated net earnings & transactions', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          host_id: 'host-uuid-1',
          total_net_earnings: 576,
          total_gross_earnings: 720,
          platform_fee_deducted: 144,
          active_bookings_count: 1,
          completed_bookings_count: 2,
          total_qualifying_bookings: 3,
          split_rule: {
            host_percentage: 80,
            platform_fee_percentage: 20,
          },
          recent_transactions: [
            {
              id: 'tx-1',
              booking_id: 'bk-1',
              spot_title: 'MG Road Metro Hub Parking',
              driver_name: 'Alex Rivera',
              gross_amount: 240,
              host_net_earnings: 192,
              platform_fee: 48,
              status: 'active',
              razorpay_payment_id: 'pay_001',
            },
          ],
        }),
      });

      const res = await fetchHostEarnings('host-jwt-token');

      expect(res.success).toBe(true);
      expect(res.total_net_earnings).toBe(576);
      expect(res.platform_fee_deducted).toBe(144);
      expect(res.recent_transactions.length).toBe(1);
      expect(res.recent_transactions[0].host_net_earnings).toBe(192);

      expect((globalThis as any).fetch).toHaveBeenCalledWith(
        expect.stringContaining('/host/earnings'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer host-jwt-token',
          }),
        })
      );
    });

    it('returns empty fallback if API fails', async () => {
      (globalThis as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      const res = await fetchHostEarnings(null);
      expect(res.success).toBe(false);
      expect(res.total_net_earnings).toBe(0);
      expect(res.recent_transactions).toEqual([]);
    });
  });
});

