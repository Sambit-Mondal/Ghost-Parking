import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import colors from '../../theme/colors';
import { Badge } from '../common/Badge';
import { formatCurrency, formatDistance } from '../../utils/formatting';

export interface ParkingSpotData {
  id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  hourly_rate: number;
  is_active: boolean;
  distance_meters?: number;
  distance_miles?: number;
  available_slots?: number;
}

interface SpotCardProps {
  spot: ParkingSpotData;
  onPress: () => void;
  onBookPress: () => void;
  selected?: boolean;
  testID?: string;
}

export const SpotCard: React.FC<SpotCardProps> = ({
  spot,
  onPress,
  onBookPress,
  selected = false,
  testID,
}) => {
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.container, selected && styles.selectedContainer]}
    >
      <View style={styles.topRow}>
        <View style={styles.titleColumn}>
          <Text style={styles.title} numberOfLines={1}>
            {spot.title}
          </Text>
          <Text style={styles.address} numberOfLines={1}>
            {spot.address}
          </Text>
        </View>

        <View style={styles.rateBadge}>
          <Text style={styles.rateAmount}>{formatCurrency(spot.hourly_rate)}</Text>
          <Text style={styles.rateUnit}>/hr</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.badges}>
          <Badge
            label={formatDistance(spot.distance_meters, spot.distance_miles)}
            variant="neutral"
          />
          <Badge
            label={spot.is_active ? 'Available' : 'Occupied'}
            variant={spot.is_active ? 'success' : 'danger'}
          />
        </View>

        <TouchableOpacity
          testID={`${testID}-reserve-btn`}
          activeOpacity={0.8}
          onPress={onBookPress}
          style={styles.bookButton}
        >
          <Text style={styles.bookText}>Reserve</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 12,
  },
  selectedContainer: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleColumn: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  address: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  rateBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  rateAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  rateUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  bookButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bookText: {
    color: '#090D16',
    fontWeight: '700',
    fontSize: 13,
  },
});
