import {
  formatCurrency,
  formatDistance,
  calculateHostSplit,
  formatTimeAgo,
} from '../../src/utils/formatting';

describe('Unit Tests: formatting utils', () => {
  describe('formatCurrency', () => {
    it('formats numbers into Indian Rupee currency representations', () => {
      const result = formatCurrency(80);
      expect(result).toMatch(/80/);
    });

    it('handles zero and large numbers', () => {
      expect(formatCurrency(0)).toMatch(/0/);
      expect(formatCurrency(16400)).toMatch(/16,400/);
    });
  });

  describe('formatDistance', () => {
    it('formats miles when provided', () => {
      expect(formatDistance(undefined, 0.4)).toBe('0.4 mi');
      expect(formatDistance(undefined, 2.5)).toBe('2.5 mi');
    });

    it('formats short miles as feet', () => {
      expect(formatDistance(undefined, 0.05)).toBe('264 ft');
    });

    it('calculates miles from meters', () => {
      // 1609.344 meters is approx 1.0 mile
      const result = formatDistance(1609);
      expect(result).toBe('1.0 mi');
    });

    it('returns fallback string when both are missing', () => {
      expect(formatDistance()).toBe('-- mi');
    });
  });

  describe('calculateHostSplit', () => {
    it('accurately calculates 80% host split and 20% platform fee', () => {
      const split100 = calculateHostSplit(100);
      expect(split100.hostShare).toBe(80);
      expect(split100.platformFee).toBe(20);

      const split240 = calculateHostSplit(240);
      expect(split240.hostShare).toBe(192);
      expect(split240.platformFee).toBe(48);
    });

    it('handles fractional splits with proper rounding', () => {
      const split75 = calculateHostSplit(75);
      expect(split75.hostShare).toBe(60);
      expect(split75.platformFee).toBe(15);
    });
  });

  describe('formatTimeAgo', () => {
    it('returns "Just now" for dates within 1 minute', () => {
      const now = new Date();
      expect(formatTimeAgo(now)).toBe('Just now');
    });

    it('returns minutes ago for dates within an hour', () => {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatTimeAgo(fiveMinsAgo)).toBe('5m ago');
    });

    it('returns hours ago for dates within 24 hours', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(formatTimeAgo(threeHoursAgo)).toBe('3h ago');
    });

    it('returns days ago for dates older than 24 hours', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(formatTimeAgo(twoDaysAgo)).toBe('2d ago');
    });
  });
});
