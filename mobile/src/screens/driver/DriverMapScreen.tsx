import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { Header } from '../../components/common/Header';
import { SpotCard, ParkingSpotData } from '../../components/driver/SpotCard';
import { MapPlaceholder } from '../../components/driver/MapPlaceholder';
import { DriverMapView } from '../../components/driver/DriverMapView';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { formatCurrency } from '../../utils/formatting';
import { fetchNearbySpots, normalizeSpot } from '../../services/spotService';
import { connectSocket, onSpotAdded, onSpotUpdated } from '../../services/socketService';
import {
  createPaymentOrder,
  openRazorpayCheckout,
  verifyPayment,
} from '../../services/paymentService';
import { useAuth } from '../../context/AuthContext';

export const INITIAL_SPOTS: ParkingSpotData[] = [
  {
    id: '4a038134-d6f6-4cff-8e93-a031dc49c32a',
    title: 'MG Road Metro Hub Parking',
    address: 'Near Trinity Metro Station, MG Road, Bengaluru',
    latitude: 12.9716,
    longitude: 77.5946,
    hourly_rate: 80,
    is_active: true,
    distance_meters: 650,
    distance_miles: 0.4,
    available_slots: 3,
  },
  {
    id: 'f9b43626-4957-477c-b1b0-84700120bdf2',
    title: 'Indiranagar 100ft Rd Garage',
    address: '12th Main Rd, HAL 2nd Stage, Indiranagar',
    latitude: 12.9784,
    longitude: 77.6408,
    hourly_rate: 120,
    is_active: true,
    distance_meters: 1900,
    distance_miles: 1.2,
    available_slots: 1,
  },
  {
    id: 'aa074775-207e-473c-9d70-b61396f6abb4',
    title: 'Koramangala Tech Park Bay',
    address: '4th Block, 80 Feet Rd, Koramangala',
    latitude: 12.9352,
    longitude: 77.6245,
    hourly_rate: 60,
    is_active: true,
    distance_meters: 3400,
    distance_miles: 2.1,
    available_slots: 5,
  },
  {
    id: '7cae0f87-775d-49aa-bb38-afbbbd6d0c32',
    title: 'Church Street Underground Bay',
    address: 'Church St, Shanthala Nagar, Ashok Nagar',
    latitude: 12.9753,
    longitude: 77.6015,
    hourly_rate: 150,
    is_active: false,
    distance_meters: 1100,
    distance_miles: 0.7,
    available_slots: 0,
  },
];

export const DriverMapScreen: React.FC = () => {
  const { user, userToken } = useAuth();

  const [spots, setSpots] = useState<ParkingSpotData[]>(INITIAL_SPOTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'affordable' | 'nearby'>('all');
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpotData | null>(INITIAL_SPOTS[0]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const handleSelectSpot = useCallback((spot: ParkingSpotData) => {
    setSelectedSpot(spot);
  }, []);

  // Booking and Razorpay payment states
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [bookingHours, setBookingHours] = useState(2);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [activePaymentRecord, setActivePaymentRecord] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState<string>('Go PostGIS Engine');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveSpotBanner, setLiveSpotBanner] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  const loadSpots = useCallback(
    async (isPullToRefresh = false, coords?: { latitude: number; longitude: number }) => {
      if (isPullToRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      const lat = coords?.latitude || userLocation?.latitude || 12.9716;
      const lng = coords?.longitude || userLocation?.longitude || 77.5946;

      try {
        const res = await fetchNearbySpots({
          latitude: lat,
          longitude: lng,
          limit: 50,
        });

        if (!isMountedRef.current) return;

        if (res.success && res.spots && res.spots.length > 0) {
          setSpots(res.spots);
          if (!selectedSpot || !res.spots.some((s) => s.id === selectedSpot.id)) {
            setSelectedSpot(res.spots[0]);
          }
          setDataSource(
            res.source === 'go_search_engine'
              ? 'Go PostGIS Engine'
              : res.source === 'express_direct'
              ? 'Express Gateway'
              : 'Cached Fallback'
          );
        } else if (res.error) {
          setErrorMessage(res.error);
        }
      } catch (err: any) {
        if (isMountedRef.current) {
          setErrorMessage(err.message || 'Unable to fetch spots');
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [selectedSpot, userLocation]
  );

  useEffect(() => {
    isMountedRef.current = true;

    const initGPS = async () => {
      let coords = { latitude: 12.9716, longitude: 77.5946 };
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (loc?.coords) {
            coords = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            if (isMountedRef.current) {
              setUserLocation(coords);
            }
          }
        }
      } catch {
        // Fallback to default coordinates
      }

      if (process.env.NODE_ENV !== 'test') {
        loadSpots(false, coords);
      }
    };

    if (process.env.NODE_ENV !== 'test') {
      initGPS();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Real-time WebSocket listener for live spot availability & status updates
  useEffect(() => {
    // Establish connection to Express Gateway WebSocket
    connectSocket({ token: userToken });

    // 1. Listen for new spots added by hosts (spot_added / new_spot_available)
    const handleSpotAdded = (rawSpot: any) => {
      if (!isMountedRef.current || !rawSpot) return;

      const normalized = normalizeSpot(rawSpot);

      if (
        typeof normalized.latitude !== 'number' ||
        isNaN(normalized.latitude) ||
        typeof normalized.longitude !== 'number' ||
        isNaN(normalized.longitude)
      ) {
        return;
      }

      setSpots((prevSpots) => {
        const exists = prevSpots.some((s) => s.id === normalized.id);
        if (exists) {
          return prevSpots.map((s) => (s.id === normalized.id ? normalized : s));
        }
        // State updates using previous state callback correctly:
        return [normalized, ...prevSpots];
      });

      setLiveSpotBanner(`New space available: ${normalized.title} (${formatCurrency(normalized.hourly_rate)}/hr)`);
      setTimeout(() => {
        if (isMountedRef.current) {
          setLiveSpotBanner(null);
        }
      }, 6000);
    };

    // 2. Listen for spot status changes (spot_updated, e.g. paused / reopened)
    const handleSpotUpdated = (updateData: { id: string; is_active: boolean; [key: string]: any }) => {
      if (!isMountedRef.current || !updateData?.id) return;

      setSpots((prevSpots) => {
        // Map through existing state and remove the pin if is_active is false
        if (updateData.is_active === false) {
          return prevSpots.filter((s) => s.id !== updateData.id);
        }
        // If reactivated or updated, update the spot in place
        return prevSpots.map((s) =>
          s.id === updateData.id ? { ...s, is_active: true } : s
        );
      });

      setLiveSpotBanner(
        updateData.is_active === false
          ? 'A nearby parking spot was just paused by its host.'
          : 'A nearby parking spot was just reopened by its host.'
      );
      setTimeout(() => {
        if (isMountedRef.current) {
          setLiveSpotBanner(null);
        }
      }, 5000);
    };

    const unsubAdded = onSpotAdded(handleSpotAdded);
    const unsubUpdated = onSpotUpdated(handleSpotUpdated);

    return () => {
      unsubAdded();
      unsubUpdated();
    };
  }, [userToken]);

  const filteredSpots = spots.filter((spot) => {
    // Only display active spots on the map
    if (spot.is_active === false) return false;

    const matchesSearch =
      spot.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spot.address.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedFilter === 'affordable') return spot.hourly_rate <= 80;
    if (selectedFilter === 'nearby') return (spot.distance_miles ?? 999) <= 1.0;
    return true;
  });

  const handleBookPress = (spot: ParkingSpotData) => {
    setSelectedSpot(spot);
    setBookingConfirmed(false);
    setPaymentError(null);
    setBookingModalVisible(true);
  };

  /**
   * Real Razorpay Checkout Lifecycle:
   * 1. POST /payments/create-order on Express Gateway to generate order_id
   * 2. react-native-razorpay native modal checkout
   * 3. POST /payments/verify with signature verification to transition booking status to 'active'
   */
  const handleConfirmBooking = async () => {
    if (!selectedSpot) return;

    setIsProcessingPayment(true);
    setPaymentError(null);

    const totalAmount = (selectedSpot.hourly_rate ?? 80) * bookingHours;

    try {
      const driverId =
        user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)
          ? user.id
          : '9b0ca6fe-3168-4ffd-b420-394126be9f5e';

      // 1. Request Order Creation from Express Gateway
      const orderRes = await createPaymentOrder(
        {
          spot_id: selectedSpot.id,
          driver_id: driverId,
          amount: totalAmount,
          hours: bookingHours,
        },
        userToken
      );

      if (!orderRes.success || !orderRes.order_id) {
        throw new Error(orderRes.error || 'Failed to initialize payment order');
      }

      // 2. Open Native Razorpay Checkout Modal
      const checkoutResult = await openRazorpayCheckout({
        key: orderRes.key_id || 'rzp_test_placeholder',
        amount: orderRes.amount || totalAmount * 100,
        currency: 'INR',
        name: 'Ghost Parking',
        description: `Reserve: ${selectedSpot.title} (${bookingHours} hrs)`,
        order_id: orderRes.order_id,
        prefill: {
          email: user?.email || 'driver@ghostparking.com',
          contact: user?.phone || '+91 98765 43210',
          name: user?.name || 'Verified Driver',
        },
        theme: { color: colors.primary },
      });

      // 3. Verify Payment Callback with Express Gateway
      const verifyRes = await verifyPayment(
        {
          booking_id: orderRes.booking_id || `bk_${Date.now()}`,
          razorpay_order_id: checkoutResult.razorpay_order_id,
          razorpay_payment_id: checkoutResult.razorpay_payment_id,
          razorpay_signature: checkoutResult.razorpay_signature,
        },
        userToken
      );

      if (!verifyRes.success) {
        throw new Error(verifyRes.error || 'Payment verification failed');
      }

      // 4. Update confirmed booking state upon verified active status
      setActivePaymentRecord({
        bookingId: orderRes.booking_id,
        paymentId: checkoutResult.razorpay_payment_id,
        orderId: checkoutResult.razorpay_order_id,
        hours: bookingHours,
        amount: totalAmount,
        spot: selectedSpot,
      });
      setBookingConfirmed(true);
    } catch (err: any) {
      setPaymentError(err.message || 'Payment processing was cancelled or failed.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <Header />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadSpots(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            testID="driver-search-input"
            style={styles.searchInput}
            placeholder="Search parking by area or landmark..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Live Backend Gateway Connection Status */}
        <View style={styles.statusBarWrapper} testID="gateway-status-bar">
          <View style={styles.statusBarLeft}>
            <View
              style={[
                styles.statusDot,
                errorMessage ? styles.statusDotWarn : styles.statusDotActive,
              ]}
            />
            <Text style={styles.statusText} numberOfLines={1}>
              {errorMessage
                ? 'Offline Cache Active'
                : `Connected: ${dataSource} (:3000)`}
            </Text>
          </View>
          <TouchableOpacity
            testID="refresh-spots-btn"
            onPress={() => loadSpots(false)}
            disabled={isLoading || isRefreshing}
            style={styles.refreshBtn}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.accent} testID="spots-loading-spinner" />
            ) : (
              <Text style={styles.refreshBtnText}>Refresh</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Real-Time Live Spot Announcement Banner */}
        {liveSpotBanner && (
          <View style={styles.liveBanner} testID="live-spot-banner">
            <Ionicons name="radio" size={16} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.liveBannerText} numberOfLines={2}>
              {liveSpotBanner}
            </Text>
          </View>
        )}

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContent}
        >
          <TouchableOpacity
            testID="filter-all"
            style={[styles.filterPill, selectedFilter === 'all' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text
              style={[
                styles.filterPillText,
                selectedFilter === 'all' && styles.filterPillTextActive,
              ]}
            >
              All Spots ({spots.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="filter-affordable"
            style={[
              styles.filterPill,
              selectedFilter === 'affordable' && styles.filterPillActive,
            ]}
            onPress={() => setSelectedFilter('affordable')}
          >
            <Text
              style={[
                styles.filterPillText,
                selectedFilter === 'affordable' && styles.filterPillTextActive,
              ]}
            >
              Under ₹100/hr
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="filter-nearby"
            style={[styles.filterPill, selectedFilter === 'nearby' && styles.filterPillActive]}
            onPress={() => setSelectedFilter('nearby')}
          >
            <Text
              style={[
                styles.filterPillText,
                selectedFilter === 'nearby' && styles.filterPillTextActive,
              ]}
            >
              Under 1.0 mi
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Interactive Map View */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Interactive Map</Text>
          <Badge label="Standard Pins" variant="driver" />
        </View>

        <DriverMapView
          testID="driver-native-map"
          spots={filteredSpots}
          selectedSpotId={selectedSpot?.id}
          onSelectSpot={handleSelectSpot}
          userLocation={userLocation}
        />

        {/* PostGIS Radar Map */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Spatial Radar Map</Text>
          <Badge label="Live PostGIS Feed" variant="driver" />
        </View>

        <MapPlaceholder
          testID="driver-map-placeholder"
          spots={filteredSpots}
          selectedSpotId={selectedSpot?.id}
          onSelectSpot={handleSelectSpot}
        />

        {/* Available Spots List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby Available Spots</Text>
          <Text style={styles.sectionCount}>{filteredSpots.length} found</Text>
        </View>

        {filteredSpots.map((spot) => (
          <SpotCard
            key={spot.id}
            testID={`spot-card-${spot.id}`}
            spot={spot}
            selected={selectedSpot?.id === spot.id}
            onPress={() => handleSelectSpot(spot)}
            onBookPress={() => handleBookPress(spot)}
          />
        ))}

        {filteredSpots.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={40} color={colors.textMuted} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No Parking Spots Found</Text>
            <Text style={styles.emptySubtitle}>
              Try adjusting your search terms or expanding your filter range.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Booking Bottom Sheet / Razorpay Modal */}
      <Modal
        visible={bookingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isProcessingPayment) {
            setBookingModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent} testID="booking-modal">
            {bookingConfirmed ? (
              <View style={styles.confirmationView} testID="booking-confirmation-view">
                <Ionicons name="checkmark-circle-outline" size={54} color={colors.success} style={styles.confirmIcon} />
                <Text style={styles.confirmTitle}>Reservation Locked!</Text>
                <Text style={styles.confirmSubtitle}>
                  {formatCurrency((selectedSpot?.hourly_rate ?? 0) * bookingHours)} held in Razorpay Escrow.
                  Your spot is reserved for {bookingHours} hours.
                </Text>

                {activePaymentRecord && (
                  <View style={styles.paymentSummaryCard}>
                    <Text style={styles.paymentSummaryLabel}>Payment Reference</Text>
                    <Text style={styles.paymentSummaryValue}>{activePaymentRecord.paymentId}</Text>
                    <Text style={styles.paymentSummaryStatus}>Status: Active & Verified</Text>
                  </View>
                )}

                <Button
                  title="Done / Return to Map"
                  variant="primary"
                  onPress={() => {
                    setBookingModalVisible(false);
                    setBookingConfirmed(false);
                  }}
                  style={{ marginTop: 16, width: '100%' }}
                />
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>{selectedSpot?.title}</Text>
                    <Text style={styles.modalAddress}>{selectedSpot?.address}</Text>
                  </View>
                  <TouchableOpacity
                    testID="close-booking-modal"
                    onPress={() => setBookingModalVisible(false)}
                    disabled={isProcessingPayment}
                    style={styles.closeModalBtn}
                  >
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {paymentError && (
                  <View style={styles.paymentErrorBanner}>
                    <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                    <Text style={styles.paymentErrorText}>{paymentError}</Text>
                  </View>
                )}

                {/* Duration selector */}
                <Text style={styles.durationLabel}>Select Duration (Hours):</Text>
                <View style={styles.durationRow}>
                  {[1, 2, 3, 4].map((hours) => (
                    <TouchableOpacity
                      key={hours}
                      testID={`duration-btn-${hours}`}
                      style={[
                        styles.durationBtn,
                        bookingHours === hours && styles.durationBtnActive,
                      ]}
                      onPress={() => setBookingHours(hours)}
                      disabled={isProcessingPayment}
                    >
                      <Text
                        style={[
                          styles.durationBtnText,
                          bookingHours === hours && styles.durationBtnTextActive,
                        ]}
                      >
                        {hours} hr{hours > 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Price Summary */}
                <View style={styles.priceSummary}>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceRowLabel}>Rate</Text>
                    <Text style={styles.priceRowValue}>
                      {formatCurrency(selectedSpot?.hourly_rate ?? 0)} / hr
                    </Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceRowLabel}>Duration</Text>
                    <Text style={styles.priceRowValue}>{bookingHours} Hours</Text>
                  </View>
                  <View style={[styles.priceRow, styles.priceRowTotal]}>
                    <Text style={styles.totalLabel}>Total Escrow Amount</Text>
                    <Text style={styles.totalValue}>
                      {formatCurrency((selectedSpot?.hourly_rate ?? 0) * bookingHours)}
                    </Text>
                  </View>
                </View>

                <View style={styles.escrowNotice}>
                  <Ionicons name="shield-checkmark-outline" size={15} color="#93C5FD" style={{ marginRight: 6 }} />
                  <Text style={styles.escrowNoticeText}>
                    Razorpay Smart Escrow: Funds release automatically upon completed check-in.
                  </Text>
                </View>

                <Button
                  testID="confirm-booking-btn"
                  title={
                    isProcessingPayment
                      ? 'Processing with Razorpay...'
                      : `Confirm & Reserve (${formatCurrency(
                          (selectedSpot?.hourly_rate ?? 0) * bookingHours
                        )})`
                  }
                  variant="primary"
                  loading={isProcessingPayment}
                  disabled={isProcessingPayment}
                  onPress={handleConfirmBooking}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
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
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 255, 0.12)',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  liveBannerText: {
    flex: 1,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    padding: 0,
  },
  filtersScroll: {
    marginBottom: 14,
  },
  filtersContent: {
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: 'rgba(0, 245, 255, 0.12)',
    borderColor: colors.primary,
  },
  filterPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  sectionCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderColor: colors.borderLight,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    maxWidth: 260,
  },
  modalAddress: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    maxWidth: 260,
  },
  closeModalBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  durationBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  durationBtnActive: {
    backgroundColor: 'rgba(0, 245, 255, 0.12)',
    borderColor: colors.primary,
  },
  durationBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  durationBtnTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  priceSummary: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceRowLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  priceRowValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  priceRowTotal: {
    marginBottom: 0,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  totalValue: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  escrowNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  escrowNoticeText: {
    fontSize: 11,
    color: '#93C5FD',
    lineHeight: 16,
    flex: 1,
  },
  paymentErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.danger,
    gap: 8,
  },
  paymentErrorText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  confirmationView: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  confirmIcon: {
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  confirmSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  paymentSummaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginTop: 16,
    alignItems: 'center',
  },
  paymentSummaryLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paymentSummaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 4,
  },
  paymentSummaryStatus: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
    marginTop: 4,
  },
  statusBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotWarn: {
    backgroundColor: '#F59E0B',
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshBtnText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
});
