import {
  formatCurrency,
  formatDistance,
  calculateHostSplit,
  formatTimeAgo,
  formatCardNumber,
  stripCardNumber,
  cleanCardNumber,
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

  describe('formatCardNumber', () => {
    it('formats raw digits into 4-digit groups separated by a single space', () => {
      expect(formatCardNumber('4000000000000002')).toBe('4000 0000 0000 0002');
      expect(formatCardNumber('5555510000081006')).toBe('5555 5100 0008 1006');
    });

    it('formats partial input dynamically as the user types', () => {
      expect(formatCardNumber('4')).toBe('4');
      expect(formatCardNumber('4000')).toBe('4000');
      expect(formatCardNumber('40001')).toBe('4000 1');
      expect(formatCardNumber('40001234')).toBe('4000 1234');
      expect(formatCardNumber('400012345')).toBe('4000 1234 5');
    });

    it('strips existing spaces and non-numeric characters before formatting', () => {
      expect(formatCardNumber('4000 0000 0000 0002')).toBe('4000 0000 0000 0002');
      expect(formatCardNumber('4000-0000-0000-0002')).toBe('4000 0000 0000 0002');
      expect(formatCardNumber('  4000  0000  ')).toBe('4000 0000');
    });

    it('caps total digits at 16, resulting in maximum 19 characters', () => {
      const longInput = '40000000000000029999999';
      const formatted = formatCardNumber(longInput);
      expect(formatted).toBe('4000 0000 0000 0002');
      expect(formatted.length).toBe(19);
    });

    it('handles empty or undefined values safely', () => {
      expect(formatCardNumber('')).toBe('');
      expect(formatCardNumber(null as any)).toBe('');
      expect(formatCardNumber(undefined as any)).toBe('');
    });
  });

  describe('stripCardNumber / cleanCardNumber', () => {
    it('strips all spaces and non-numeric characters to return clean digits', () => {
      expect(stripCardNumber('4000 0000 0000 0002')).toBe('4000000000000002');
      expect(cleanCardNumber('5555 5100 0008 1006')).toBe('5555510000081006');
      expect(stripCardNumber('4000-0000-0000-0002')).toBe('4000000000000002');
    });

    it('caps clean digits at 16', () => {
      expect(stripCardNumber('12345678901234567890')).toBe('1234567890123456');
    });

    it('handles empty or invalid inputs gracefully', () => {
      expect(stripCardNumber('')).toBe('');
      expect(cleanCardNumber(null as any)).toBe('');
    });
  });
});
