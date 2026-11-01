import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { formatCurrency, calculateHostSplit } from '../../utils/formatting';
import { useAuth } from '../../context/AuthContext';
import { connectSocket, onBookingUpdated } from '../../services/socketService';

export interface HostReservation {
  id: string;
  spotTitle: string;
  driverName: string;
  vehiclePlate: string;
  timeWindow: string;
  grossAmount: number;
  status: 'active' | 'upcoming' | 'completed';
  escrowStatus: 'locked' | 'settled';
}

export const INITIAL_HOST_RESERVATIONS: HostReservation[] = [
  {
    id: 'h_res_101',
    spotTitle: 'MG Road Metro Hub Parking (Bay A-12)',
    driverName: 'Alex Rivera',
    vehiclePlate: 'KA 03 MZ 4192',
    timeWindow: 'Today, 02:00 PM - 05:00 PM',
    grossAmount: 240,
    status: 'active',
    escrowStatus: 'locked',
  },
  {
    id: 'h_res_102',
    spotTitle: 'Indiranagar 100ft Rd Garage (Bay C-04)',
    driverName: 'Priya Sharma',
    vehiclePlate: 'KA 01 EK 8810',
    timeWindow: 'Tomorrow, 10:00 AM - 12:00 PM',
    grossAmount: 240,
    status: 'upcoming',
    escrowStatus: 'locked',
  },
  {
    id: 'h_res_103',
    spotTitle: 'MG Road Metro Hub Parking (Bay A-12)',
    driverName: 'Rohan Gupta',
    vehiclePlate: 'KA 05 AB 1234',
    timeWindow: 'Yesterday, 04:00 PM - 07:00 PM',
    grossAmount: 240,
    status: 'completed',
    escrowStatus: 'settled',
  },
];

export const HostReservationsScreen: React.FC = () => {
  const { userToken } = useAuth();
  const [reservations, setReservations] = useState<HostReservation[]>(INITIAL_HOST_RESERVATIONS);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [liveBanner, setLiveBanner] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // Connect socket with authenticated Host token to join private room_user_{id}
    connectSocket({ token: userToken });

    // Listen for targeted 'booking_updated' socket events
    const handleBookingUpdated = (rawBooking: any) => {
      if (!isMountedRef.current || !rawBooking || !rawBooking.id) return;

      const mappedStatus: 'active' | 'upcoming' | 'completed' =
        rawBooking.status === 'completed'
          ? 'completed'
          : rawBooking.status === 'active'
          ? 'active'
          : 'upcoming';

      const escrowStatus: 'locked' | 'settled' =
        rawBooking.status === 'completed' ? 'settled' : 'locked';

      const spotTitle =
        rawBooking.spot?.title || rawBooking.spotTitle || 'Parking Bay';
      const driverName =
        rawBooking.driver?.name || rawBooking.driverName || 'Verified Driver';
      const vehiclePlate =
        rawBooking.vehiclePlate || 'KA 01 GP 2026';
      const grossAmount =
        parseFloat(rawBooking.total_amount || rawBooking.grossAmount || 0);

      const normalized: HostReservation = {
        id: rawBooking.id,
        spotTitle,
        driverName,
        vehiclePlate,
        timeWindow: rawBooking.timeWindow || 'Session in Progress',
        grossAmount: grossAmount > 0 ? grossAmount : 160,
        status: mappedStatus,
        escrowStatus,
      };

      setReservations((prev) => {
        const index = prev.findIndex((r) => r.id === normalized.id);
        if (index >= 0) {
          // Transition existing reservation across UI tabs in-place
          const updated = [...prev];
          updated[index] = { ...updated[index], ...normalized };
          return updated;
        }
        // Dynamically prepend new incoming reservation
        return [normalized, ...prev];
      });

      setLiveBanner(`Live update: ${spotTitle} is now ${mappedStatus.toUpperCase()}`);
      setTimeout(() => {
        if (isMountedRef.current) {
          setLiveBanner(null);
        }
      }, 5000);
    };

    const unsubscribe = onBookingUpdated(handleBookingUpdated);

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [userToken]);

  const filtered = reservations.filter((r) => {
    if (filter === 'active') return r.status === 'active' || r.status === 'upcoming';
    if (filter === 'completed') return r.status === 'completed';
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <Header title="Driver Bookings" subtitle="Live occupant activity and payouts" />

      {/* Real-time WebSocket Event Notification Banner */}
      {liveBanner && (
        <View style={styles.liveBanner} testID="host-live-banner">
          <Ionicons name="flash" size={14} color="#00F5FF" style={{ marginRight: 6 }} />
          <Text style={styles.liveBannerText} numberOfLines={1}>
            {liveBanner}
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Filter Pills */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            testID="host-res-all"
            style={[styles.tabButton, filter === 'all' && styles.tabButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.tabText, filter === 'all' && styles.tabTextActive]}>All</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="host-res-active"
            style={[styles.tabButton, filter === 'active' && styles.tabButtonActive]}
            onPress={() => setFilter('active')}
          >
            <Text style={[styles.tabText, filter === 'active' && styles.tabTextActive]}>
              Active / Upcoming
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="host-res-completed"
            style={[styles.tabButton, filter === 'completed' && styles.tabButtonActive]}
            onPress={() => setFilter('completed')}
          >
            <Text style={[styles.tabText, filter === 'completed' && styles.tabTextActive]}>
              Settled
            </Text>
          </TouchableOpacity>
        </View>

        {filtered.map((item) => {
          const split = calculateHostSplit(item.grossAmount);
          return (
            <Card key={item.id} testID={`host-res-card-${item.id}`} style={styles.card}>
              <View style={styles.headerRow}>
                <View style={styles.titleCol}>
                  <Text style={styles.spotTitle}>{item.spotTitle}</Text>
                  <Text style={styles.driverInfo}>
                    Driver: {item.driverName} • {item.vehiclePlate}
                  </Text>
                </View>
                <Badge
                  label={item.status.toUpperCase()}
                  variant={item.status === 'active' ? 'success' : 'neutral'}
                />
              </View>

              <View style={styles.payoutGrid}>
                <View style={styles.payoutCol}>
                  <Text style={styles.payoutLabel}>Total Paid</Text>
                  <Text style={styles.payoutValue}>{formatCurrency(item.grossAmount)}</Text>
                </View>

                <View style={styles.payoutCol}>
                  <Text style={styles.payoutLabel}>Your Cut (80%)</Text>
                  <Text style={styles.payoutHighlight}>{formatCurrency(split.hostShare)}</Text>
                </View>

                <View style={styles.payoutCol}>
                  <Text style={styles.payoutLabel}>Escrow Status</Text>
                  <Text
                    style={[
                      styles.escrowStatus,
                      item.escrowStatus === 'settled' && styles.escrowSettled,
                    ]}
                  >
                    {item.escrowStatus === 'settled' ? 'Settled' : 'Held'}
                  </Text>
                </View>
              </View>

              <Text style={styles.timeWindow}>{item.timeWindow}</Text>
            </Card>
          );
        })}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleCol: {
    flex: 1,
    marginRight: 10,
  },
  spotTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  driverInfo: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  payoutGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 12,
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  payoutCol: {
    alignItems: 'center',
  },
  payoutLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 3,
  },
  payoutValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  payoutHighlight: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  escrowStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
  },
  escrowSettled: {
    color: colors.success,
  },
  timeWindow: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 255, 0.1)',
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  liveBannerText: {
    color: '#00F5FF',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
});
