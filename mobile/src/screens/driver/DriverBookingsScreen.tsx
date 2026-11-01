import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { Header } from '../../components/common/Header';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { formatCurrency } from '../../utils/formatting';
import { isWithinCheckInRadius, createOffsetCoordinate } from '../../utils/geo';
import { checkInBooking, fetchMyBookings } from '../../services/bookingService';
import { useAuth } from '../../context/AuthContext';
import { connectSocket, onBookingUpdated } from '../../services/socketService';

export interface BookingItem {
  id: string;
  spotTitle: string;
  address: string;
  latitude: number;
  longitude: number;
  startTime: string;
  endTime: string;
  durationHours: number;
  totalAmount: number;
  status: 'active' | 'upcoming' | 'completed';
  escrowStatus: 'held' | 'released' | 'refunded';
  spotNumber: string;
  checkedIn?: boolean;
  checkedInAt?: string;
  distanceAtCheckIn?: number;
}

export const DriverBookingsScreen: React.FC = () => {
  const { userToken } = useAuth();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [liveBanner, setLiveBanner] = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [checkInStatus, setCheckInStatus] = useState<{
    bookingId: string;
    type: 'success' | 'error';
    message: string;
    distanceMeters?: number;
  } | null>(null);
  const isMountedRef = useRef(true);

  const loadBookings = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const res = await fetchMyBookings(userToken);
        if (isMountedRef.current && res.success && Array.isArray(res.bookings)) {
          const normalizedList: BookingItem[] = res.bookings.map((b: any) => {
            const mappedStatus: 'active' | 'upcoming' | 'completed' =
              b.status === 'completed'
                ? 'completed'
                : b.status === 'active'
                ? 'active'
                : b.status === 'cancelled'
                ? 'completed'
                : 'upcoming';

            const escrowStatus: 'held' | 'released' | 'refunded' =
              b.status === 'completed'
                ? 'released'
                : b.status === 'cancelled'
                ? 'refunded'
                : 'held';

            const spotTitle = b.spot?.title || b.spotTitle || 'Reserved Parking Bay';
            const address = b.spot?.address || b.address || 'Bengaluru, KA';
            const latitude = b.spot?.latitude || b.latitude || 12.9716;
            const longitude = b.spot?.longitude || b.longitude || 77.5946;
            const totalAmount = parseFloat(b.total_amount || b.totalAmount || 0);

            const startTime = b.start_time
              ? 'Today, ' +
                new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Today, 10:00 AM';
            const endTime = b.end_time
              ? 'Today, ' +
                new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Today, 12:00 PM';

            return {
              id: b.id,
              spotTitle,
              address,
              latitude: Number(latitude),
              longitude: Number(longitude),
              startTime,
              endTime,
              durationHours: 2,
              totalAmount: totalAmount > 0 ? totalAmount : 160,
              status: mappedStatus,
              escrowStatus,
              spotNumber: b.spotNumber || 'Bay A-01',
              checkedIn: mappedStatus === 'active',
              checkedInAt: b.checked_in_at
                ? new Date(b.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : undefined,
            };
          });
          setBookings(normalizedList);
        }
      } catch {
        // Keep existing state
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [userToken]
  );

  // WebSocket listener for real-time reservation updates
  useEffect(() => {
    isMountedRef.current = true;
    loadBookings();

    // Connect socket with driver JWT so it joins room_user_{id}
    connectSocket({ token: userToken });

    const handleBookingUpdated = (rawBooking: any) => {
      if (!isMountedRef.current || !rawBooking || !rawBooking.id) return;

      const mappedStatus: 'active' | 'upcoming' | 'completed' =
        rawBooking.status === 'completed'
          ? 'completed'
          : rawBooking.status === 'active'
          ? 'active'
          : rawBooking.status === 'cancelled'
          ? 'completed'
          : 'upcoming';

      const escrowStatus: 'held' | 'released' | 'refunded' =
        rawBooking.status === 'completed'
          ? 'released'
          : rawBooking.status === 'cancelled'
          ? 'refunded'
          : 'held';

      setBookings((prev) => {
        const index = prev.findIndex((b) => b.id === rawBooking.id);
        if (index >= 0) {
          const updated = [...prev];
          const existing = updated[index];
          updated[index] = {
            ...existing,
            status: mappedStatus,
            escrowStatus,
            checkedIn: rawBooking.status === 'active' ? true : existing.checkedIn,
            checkedInAt:
              rawBooking.status === 'active'
                ? existing.checkedInAt || 'Verified GPS'
                : existing.checkedInAt,
          };
          return updated;
        }

        // Dynamically prepend new incoming reservation
        const newBooking: BookingItem = {
          id: rawBooking.id,
          spotTitle: rawBooking.spot?.title || rawBooking.spotTitle || 'Reserved Parking Bay',
          address: rawBooking.spot?.address || rawBooking.address || 'Bengaluru, KA',
          latitude: rawBooking.spot?.latitude || rawBooking.latitude || 12.9716,
          longitude: rawBooking.spot?.longitude || rawBooking.longitude || 77.5946,
          startTime: 'Today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          endTime:
            'Today, ' +
            new Date(Date.now() + 2 * 3600 * 1000).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          durationHours: 2,
          totalAmount: parseFloat(rawBooking.total_amount || rawBooking.totalAmount || 160),
          status: mappedStatus,
          escrowStatus,
          spotNumber: rawBooking.spotNumber || 'Bay 01',
          checkedIn: mappedStatus === 'active',
        };
        return [newBooking, ...prev];
      });

      setLiveBanner(`Reservation ${rawBooking.id.substring(0, 8)} status: ${mappedStatus.toUpperCase()}`);
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
  }, [userToken, loadBookings]);

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'active') return b.status === 'active' || b.status === 'upcoming';
    if (filter === 'completed') return b.status === 'completed';
    return true;
  });

  /**
   * Check-in action triggered when user taps 'I have arrived'.
   * @param booking Target booking to check in for
   * @param testDistanceOverride Optional override distance in meters for automated testing or simulation
   */
  const handleCheckIn = async (
    booking: BookingItem,
    testDistanceOverride?: number
  ) => {
    setCheckingInId(booking.id);
    setCheckInStatus(null);

    try {
      let deviceCoords: { latitude: number; longitude: number };
      let distanceMeters: number;

      if (typeof testDistanceOverride === 'number') {
        // Simulated GPS coordinate at the requested distance offset
        deviceCoords = createOffsetCoordinate(
          { latitude: booking.latitude, longitude: booking.longitude },
          testDistanceOverride
        );
        distanceMeters = testDistanceOverride;
      } else {
        // Request GPS permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          const errMsg =
            'Location permission is required to verify you have arrived at your parking spot.';
          setCheckInStatus({
            bookingId: booking.id,
            type: 'error',
            message: errMsg,
          });
          Alert.alert('Permission Denied', errMsg);
          setCheckingInId(null);
          return;
        }

        // Get device current location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        deviceCoords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        const radiusCheck = isWithinCheckInRadius(deviceCoords, {
          latitude: booking.latitude,
          longitude: booking.longitude,
        });

        distanceMeters = radiusCheck.distanceMeters;
      }

      // Check 50-meter threshold rule
      if (distanceMeters > 50) {
        const errorMsg = `Check-In Failed: You are ${distanceMeters}m away from the spot. You must be within 50 meters to check in.`;
        setCheckInStatus({
          bookingId: booking.id,
          type: 'error',
          message: errorMsg,
          distanceMeters,
        });

        Alert.alert(
          'Check-In Failed: Too Far',
          `You are currently ${distanceMeters} meters away from ${booking.spotTitle}.\n\nYou must be within 50 meters to activate your parking session.`
        );
        setCheckingInId(null);
        return;
      }

      // Device is within 50 meters: Send POST to Express Gateway /bookings/check-in
      const apiResult = await checkInBooking({
        bookingId: booking.id,
        latitude: deviceCoords.latitude,
        longitude: deviceCoords.longitude,
        distanceMeters,
      });

      if (!apiResult.success) {
        const failureMsg = `Check-In Failed: ${apiResult.message}`;
        setCheckInStatus({
          bookingId: booking.id,
          type: 'error',
          message: failureMsg,
          distanceMeters,
        });
        Alert.alert('Check-In Error', failureMsg);
        setCheckingInId(null);
        return;
      }

      // Check-in verified and accepted by gateway!
      const checkInTime = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      setBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id
            ? {
                ...b,
                status: 'active',
                checkedIn: true,
                checkedInAt: checkInTime,
                distanceAtCheckIn: distanceMeters,
              }
            : b
        )
      );

      const successMsg = `Session Activated! Verified within ${distanceMeters}m of spot.`;
      setCheckInStatus({
        bookingId: booking.id,
        type: 'success',
        message: successMsg,
        distanceMeters,
      });

      Alert.alert(
        'Check-In Successful! 🅿️',
        `Welcome to ${booking.spotTitle} (${booking.spotNumber})!\n\nGPS verified (${distanceMeters}m away). Your parking session is now ACTIVE and escrow is engaged.`
      );
    } catch (err: any) {
      const errorMsg = err.message || 'An unexpected error occurred during check-in.';
      setCheckInStatus({
        bookingId: booking.id,
        type: 'error',
        message: errorMsg,
      });
      Alert.alert('Check-In Error', errorMsg);
    } finally {
      setCheckingInId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <Header title="My Reservations" subtitle="Active and past parking sessions" />

      {/* Real-time WebSocket Event Notification Banner */}
      {liveBanner && (
        <View style={styles.liveBanner} testID="driver-live-banner">
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
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadBookings(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
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

        {isLoading ? (
          <View style={styles.loadingContainer} testID="driver-bookings-loading">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Fetching your reservations...</Text>
          </View>
        ) : filteredBookings.length === 0 ? (
          <View style={styles.emptyView} testID="driver-bookings-empty">
            <Ionicons name="receipt-outline" size={40} color={colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No reservations found</Text>
            <Text style={styles.emptySubtitle}>You have no parking sessions in this view.</Text>
          </View>
        ) : (
          filteredBookings.map((booking) => {
          const isCheckingIn = checkingInId === booking.id;
          const statusRecord = checkInStatus?.bookingId === booking.id ? checkInStatus : null;

          return (
            <Card key={booking.id} testID={`booking-card-${booking.id}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.titleArea}>
                  <Text style={styles.spotTitle}>{booking.spotTitle}</Text>
                  <Text style={styles.address}>{booking.address}</Text>
                </View>
                <Badge
                  label={booking.status === 'active' && booking.checkedIn ? 'CHECKED IN' : booking.status.toUpperCase()}
                  variant={
                    booking.checkedIn || booking.status === 'active'
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
                  {booking.startTime} - {booking.endTime}
                </Text>
              </View>

              {/* Check-In Status Feedback Banner */}
              {statusRecord && (
                <View
                  testID={`check-in-feedback-${booking.id}`}
                  style={[
                    styles.feedbackBanner,
                    statusRecord.type === 'error'
                      ? styles.feedbackBannerError
                      : styles.feedbackBannerSuccess,
                  ]}
                >
                  <Text
                    style={[
                      styles.feedbackText,
                      statusRecord.type === 'error'
                        ? styles.feedbackTextError
                        : styles.feedbackTextSuccess,
                    ]}
                  >
                    {statusRecord.message}
                  </Text>
                </View>
              )}

              {/* Check-In Details if already checked in */}
              {booking.checkedIn && (
                <View style={styles.checkedInRow}>
                  <Text style={styles.checkedInBadge}>
                    Session Active (Checked-in at {booking.checkedInAt || 'Verified'})
                  </Text>
                  {booking.distanceAtCheckIn !== undefined && (
                    <Text style={styles.checkedInDistance}>
                      {booking.distanceAtCheckIn}m from bay
                    </Text>
                  )}
                </View>
              )}

              {/* Action Buttons & Check-In Trigger */}
              <View style={styles.actionContainer}>
                <View style={styles.escrowRow}>
                  <Text style={styles.escrowBadge}>
                    {booking.escrowStatus === 'held' ? 'Escrow Held' : 'Escrow Settled'}
                  </Text>
                </View>

                {/* Primary 'I have arrived' Button for upcoming/active bookings not yet checked in */}
                {!booking.checkedIn && booking.status !== 'completed' && (
                  <View style={styles.checkInArea}>
                    <TouchableOpacity
                      testID={`check-in-btn-${booking.id}`}
                      style={[styles.arrivedBtn, isCheckingIn && styles.arrivedBtnLoading]}
                      onPress={() => handleCheckIn(booking)}
                      disabled={isCheckingIn}
                      activeOpacity={0.85}
                    >
                      {isCheckingIn ? (
                        <View style={styles.loadingRow}>
                          <ActivityIndicator size="small" color="#0B0F19" />
                          <Text style={styles.arrivedBtnText}>{'Verifying GPS (<50m)...'}</Text>
                        </View>
                      ) : (
                        <Text style={styles.arrivedBtnText}>I have arrived (Check In)</Text>
                      )}
                    </TouchableOpacity>

                    {/* Quick GPS Simulation Chips for on-device and automated testing */}
                    <View style={styles.simulationRow}>
                      <Text style={styles.simulationLabel}>GPS Test:</Text>
                      <TouchableOpacity
                        testID={`simulate-arrived-${booking.id}`}
                        style={styles.simulationChip}
                        onPress={() => handleCheckIn(booking, 18)}
                        disabled={isCheckingIn}
                      >
                        <Text style={styles.simulationChipText}>Test Arrived (18m)</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        testID={`simulate-far-${booking.id}`}
                        style={[styles.simulationChip, styles.simulationChipFar]}
                        onPress={() => handleCheckIn(booking, 120)}
                        disabled={isCheckingIn}
                      >
                        <Text style={[styles.simulationChipText, styles.simulationChipTextFar]}>
                          Test Far (120m)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </Card>
          );
        })
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
    color: colors.textPrimary,
  },
  card: {
    marginBottom: 16,
    padding: 16,
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
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  address: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  detailsGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  detailValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  detailValueHighlight: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  timingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 10,
  },
  timingLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  timingValue: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  feedbackBanner: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
  },
  feedbackBannerError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  feedbackBannerSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  feedbackText: {
    fontSize: 12,
    lineHeight: 16,
  },
  feedbackTextError: {
    color: '#F87171',
    fontWeight: '600',
  },
  feedbackTextSuccess: {
    color: '#34D399',
    fontWeight: '600',
  },
  checkedInRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 10,
  },
  checkedInBadge: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  checkedInDistance: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '600',
  },
  actionContainer: {
    marginTop: 4,
  },
  escrowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  escrowBadge: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  checkInArea: {
    gap: 8,
  },
  arrivedBtn: {
    backgroundColor: '#00F5FF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00F5FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  arrivedBtnLoading: {
    opacity: 0.8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrivedBtnText: {
    color: '#0B0F19',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  simulationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  simulationLabel: {
    color: colors.textMuted,
    fontSize: 11,
  },
  simulationChip: {
    backgroundColor: 'rgba(0, 245, 255, 0.1)',
    borderColor: 'rgba(0, 245, 255, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  simulationChipText: {
    color: '#00F5FF',
    fontSize: 10,
    fontWeight: '600',
  },
  simulationChipFar: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  simulationChipTextFar: {
    color: '#F87171',
  },
  emptyView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 12,
    fontWeight: '500',
  },
});
