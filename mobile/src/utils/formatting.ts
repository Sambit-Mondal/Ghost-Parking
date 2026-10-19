/**
 * Formatting utility functions for Ghost Parking
 */

export const formatCurrency = (amount: number, currency: string = 'INR'): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDistance = (meters?: number, miles?: number): string => {
  if (miles !== undefined && miles !== null) {
    if (miles < 0.1) {
      return `${Math.round(miles * 5280)} ft`;
    }
    return `${miles.toFixed(1)} mi`;
  }
  if (meters !== undefined && meters !== null) {
    const calculatedMiles = meters / 1609.344;
    return `${calculatedMiles.toFixed(1)} mi`;
  }
  return '-- mi';
};

export const calculateHostSplit = (totalAmount: number): { hostShare: number; platformFee: number } => {
  const hostShare = Math.round(totalAmount * 0.80);
  const platformFee = totalAmount - hostShare;
  return { hostShare, platformFee };
};

export const formatTimeAgo = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
};
