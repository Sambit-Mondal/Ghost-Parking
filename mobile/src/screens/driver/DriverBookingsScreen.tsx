import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../../theme/colors';
import { Header } from '../../components/common/Header';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { formatCurrency } from '../../utils/formatting';

interface BookingItem {
  id: string;
  spotTitle: string;
  address: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  totalAmount: number;
  status: 'active' | 'upcoming' | 'completed';
  escrowStatus: 'held' | 'released' | 'refunded';
  spotNumber: string;
}

const INITIAL_BOOKINGS: BookingItem[] = [
  {
    id: 'res_live_772',
    spotTitle: 'MG Road Metro Hub Parking',
    address: 'Near Trinity Metro Station, MG Road, Bengaluru',
    startTime: 'Today, 02:00 PM',
    endTime: 'Today, 05:00 PM',
    durationHours: 3,
    totalAmount: 240,
    status: 'active',
    escrowStatus: 'held',
    spotNumber: 'Bay A-12',
  },
  {
    id: 'res_up_381',
    spotTitle: 'Indiranagar 100ft Rd Garage',
    address: '12th Main Rd, HAL 2nd Stage, Indiranagar',
    startTime: 'Tomorrow, 10:00 AM',
    endTime: 'Tomorrow, 12:00 PM',
    durationHours: 2,
    totalAmount: 240,
    status: 'upcoming',
    escrowStatus: 'held',
    spotNumber: 'Bay C-04',
  },
  {
    id: 'res_past_904',
    spotTitle: 'Koramangala Tech Park Bay',
    address: '4th Block, 80 Feet Rd, Koramangala',
    startTime: 'Yesterday, 09:00 AM',
    endTime: 'Yesterday, 01:00 PM',
    durationHours: 4,
    totalAmount: 240,
    status: 'completed',
    escrowStatus: 'released',
    spotNumber: 'Bay B-08',
  },
];

export const DriverBookingsScreen: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const filteredBookings = INITIAL_BOOKINGS.filter((b) => {
    if (filter === 'active') return b.status === 'active' || b.status === 'upcoming';
    if (filter === 'completed') return b.status === 'completed';
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <Header title="My Reservations" subtitle="Active and past parking sessions" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Filter Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            testID="filter-tab-all"
            style={[styles.tabButton, filter === 'all' && styles.tabButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.tabText, filter === 'all' && styles.tabTextActive]}>All</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="filter-tab-active"
            style={[styles.tabButton, filter === 'active' && styles.tabButtonActive]}
            onPress={() => setFilter('active')}
          >
            <Text style={[styles.tabText, filter === 'active' && styles.tabTextActive]}>Active</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="filter-tab-completed"
            style={[styles.tabButton, filter === 'completed' && styles.tabButtonActive]}
            onPress={() => setFilter('completed')}
          >
            <Text style={[styles.tabText, filter === 'completed' && styles.tabTextActive]}>
              Completed
            </Text>
          </TouchableOpacity>
        </View>

        {filteredBookings.map((booking) => (
          <Card key={booking.id} testID={`booking-card-${booking.id}`} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.titleArea}>
                <Text style={styles.spotTitle}>{booking.spotTitle}</Text>
                <Text style={styles.address}>{booking.address}</Text>
              </View>
              <Badge
                label={booking.status.toUpperCase()}
                variant={
                  booking.status === 'active'
                    ? 'success'
                    : booking.status === 'upcoming'
                    ? 'warning'
                    : 'neutral'
                }
              />
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Slot</Text>
                <Text style={styles.detailValue}>{booking.spotNumber}</Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>{booking.durationHours} hrs</Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Total Paid</Text>
                <Text style={styles.detailValueHighlight}>
                  {formatCurrency(booking.totalAmount)}
                </Text>
              </View>
            </View>

            <View style={styles.timingRow}>
              <Text style={styles.timingLabel}>Time Window:</Text>
              <Text style={styles.timingValue}>
                {booking.startTime} ➔ {booking.endTime}
              </Text>
            </View>

            <View style={styles.escrowRow}>
              <Text style={styles.escrowBadge}>
                {booking.escrowStatus === 'held' ? '🔒 Escrow Held' : '✓ Escrow Settled'}
              </Text>
              {booking.status === 'active' && (
                <TouchableOpacity style={styles.actionBtn}>
                  <Text style={styles.actionBtnText}>Navigate to Slot</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>
        ))}

        {filteredBookings.length === 0 && (
          <View style={styles.emptyView}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No reservations found</Text>
            <Text style={styles.emptySubtitle}>You have no parking sessions in this view.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.card,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  card: {
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleArea: {
    flex: 1,
    marginRight: 10,
  },
  spotTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  address: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  detailsGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    justifyContent: 'space-around',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  detailValueHighlight: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  timingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timingLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  timingValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  escrowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 10,
  },
  escrowBadge: {
    fontSize: 11,
    color: '#93C5FD',
    fontWeight: '600',
  },
  actionBtn: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
  },
  actionBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyView: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
