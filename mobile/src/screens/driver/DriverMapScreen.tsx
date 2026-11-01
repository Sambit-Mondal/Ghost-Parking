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
  processTestCardPayment,
  isNativeRazorpayAvailable,
} from '../../services/paymentService';
import { useAuth } from '../../context/AuthContext';

export const DriverMapScreen: React.FC = () => {
  const { user, userToken } = useAuth();

  const [spots, setSpots] = useState<ParkingSpotData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'affordable' | 'nearby'>('all');
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpotData | null>(null);
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

  // In-App Razorpay Test Modal states (Expo Go fallback)
  const [showTestModal, setShowTestModal] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<{
    orderId: string;
    bookingId: string;
    amount: number;
  } | null>(null);
  const [testCardNumber, setTestCardNumber] = useState('4000 0000 0000 0002');
  const [testExpiry, setTestExpiry] = useState('12/30');
  const [testCvv, setTestCvv] = useState('123');
  const [testCardholder, setTestCardholder] = useState('Verified Driver');

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

      loadSpots(false, coords);
    };

    initGPS();

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

      // 2. Check if Native Razorpay binary is present (Bare / EAS build)
      if (isNativeRazorpayAvailable()) {
        const razorpayKey =
          orderRes.key_id ||
          process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ||
          'rzp_test_TpMSjWEuKaM6of';

        const checkoutResult = await openRazorpayCheckout({
          key: razorpayKey,
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

        // 3. Cryptographically Verify Signature with Express Gateway
        const verifyRes = await verifyPayment(
          {
            booking_id: orderRes.booking_id || `bk_${Date.now()}`,
            razorpay_order_id: checkoutResult.razorpay_order_id || orderRes.order_id,
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
      } else {
        // Expo Go session: Transition to interactive Razorpay Test Modal for manual card entry
        setPendingOrderData({
          orderId: orderRes.order_id,
          bookingId: orderRes.booking_id || `bk_${Date.now()}`,
          amount: totalAmount,
        });
        setShowTestModal(true);
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Payment processing was cancelled or failed.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  /**
   * Authorizes manual test card details entered in the Razorpay Test Modal
   * and cryptographically verifies with Express Gateway.
   */
  const handleExecuteTestCardPayment = async () => {
    if (!pendingOrderData || !selectedSpot) return;

    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      // 1. Authorize test card on Express Gateway
      const cardRes = await processTestCardPayment(
        {
          order_id: pendingOrderData.orderId,
          card_number: testCardNumber,
          expiry: testExpiry,
          cvv: testCvv,
        },
        userToken
      );

      if (!cardRes.success || !cardRes.razorpay_signature || !cardRes.razorpay_payment_id) {
        throw new Error(cardRes.error || 'Card payment authorization failed');
      }

      // 2. Cryptographically Verify Signature with Express Gateway (HMAC-SHA256)
      const verifyRes = await verifyPayment(
        {
          booking_id: pendingOrderData.bookingId,
          razorpay_order_id: cardRes.razorpay_order_id || pendingOrderData.orderId,
          razorpay_payment_id: cardRes.razorpay_payment_id,
          razorpay_signature: cardRes.razorpay_signature,
        },
        userToken
      );

      if (!verifyRes.success) {
        throw new Error(verifyRes.error || 'Payment signature verification failed');
      }

      // 3. Update confirmed booking state upon verified active status
      setActivePaymentRecord({
        bookingId: pendingOrderData.bookingId,
        paymentId: cardRes.razorpay_payment_id,
        orderId: cardRes.razorpay_order_id || pendingOrderData.orderId,
        hours: bookingHours,
        amount: pendingOrderData.amount,
        spot: selectedSpot,
      });

      setShowTestModal(false);
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
            ) : showTestModal && pendingOrderData ? (
              <View style={styles.testModalContainer} testID="razorpay-test-modal">
                <View style={styles.testModalHeader}>
                  <View style={styles.razorpayBadgeRow}>
                    <View style={styles.razorpayLogoBox}>
                      <Text style={styles.razorpayLogoText}>R</Text>
                    </View>
                    <View>
                      <Text style={styles.testModalTitle}>Razorpay Checkout</Text>
                      <Text style={styles.testModalSubtitle}>TEST MODE • Ghost Parking Escrow</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setShowTestModal(false);
                      setIsProcessingPayment(false);
                    }}
                    disabled={isProcessingPayment}
                    style={styles.closeModalBtn}
                  >
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.testAmountBanner}>
                  <Text style={styles.testAmountLabel}>Total Escrow Amount</Text>
                  <Text style={styles.testAmountValue}>{formatCurrency(pendingOrderData.amount)}</Text>
                  <Text style={styles.testOrderIdText}>Order ID: {pendingOrderData.orderId}</Text>
                </View>

                {paymentError && (
                  <View style={styles.paymentErrorBanner}>
                    <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                    <Text style={styles.paymentErrorText}>{paymentError}</Text>
                  </View>
                )}

                <Text style={styles.testCardSectionTitle}>Enter Test Card Details:</Text>

                <View style={styles.testInputGroup}>
                  <Text style={styles.testInputLabel}>Test Card Number</Text>
                  <TextInput
                    style={styles.testTextInput}
                    value={testCardNumber}
                    onChangeText={setTestCardNumber}
                    placeholder="4000 0000 0000 0002"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    editable={!isProcessingPayment}
                  />
                </View>

                <View style={styles.testInputRow}>
                  <View style={[styles.testInputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.testInputLabel}>Expiry (MM/YY)</Text>
                    <TextInput
                      style={styles.testTextInput}
                      value={testExpiry}
                      onChangeText={setTestExpiry}
                      placeholder="12/30"
                      placeholderTextColor={colors.textMuted}
                      editable={!isProcessingPayment}
                    />
                  </View>

                  <View style={[styles.testInputGroup, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.testInputLabel}>CVV</Text>
                    <TextInput
                      style={styles.testTextInput}
                      value={testCvv}
                      onChangeText={setTestCvv}
                      placeholder="123"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      secureTextEntry
                      editable={!isProcessingPayment}
                    />
                  </View>
                </View>

                <View style={styles.testInputGroup}>
                  <Text style={styles.testInputLabel}>Cardholder Name</Text>
                  <TextInput
                    style={styles.testTextInput}
                    value={testCardholder}
                    onChangeText={setTestCardholder}
                    placeholder="Verified Driver"
                    placeholderTextColor={colors.textMuted}
                    editable={!isProcessingPayment}
                  />
                </View>

                <View style={styles.testCardNotice}>
                  <Ionicons name="shield-checkmark-outline" size={16} color="#00F0FF" style={{ marginRight: 6 }} />
                  <Text style={styles.testCardNoticeText}>
                    Razorpay Test Sandbox: Submitting signs with RAZORPAY_KEY_SECRET and validates HMAC SHA256.
                  </Text>
                </View>

                <Button
                  testID="submit-test-payment-btn"
                  title={
                    isProcessingPayment
                      ? 'Authorizing with Razorpay...'
                      : `Authorize & Pay (${formatCurrency(pendingOrderData.amount)})`
                  }
                  variant="primary"
                  loading={isProcessingPayment}
                  disabled={isProcessingPayment}
                  onPress={handleExecuteTestCardPayment}
                  style={{ marginTop: 8 }}
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
                      : `Pay Now & Reserve (${formatCurrency(
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
  testModalContainer: {
    paddingVertical: 8,
  },
  testModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  razorpayBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  razorpayLogoBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0C2340',
    borderWidth: 1,
    borderColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  razorpayLogoText: {
    color: '#38BDF8',
    fontWeight: '900',
    fontSize: 17,
  },
  testModalTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  testModalSubtitle: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  testAmountBanner: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  testAmountLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  testAmountValue: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  testOrderIdText: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  testCardSectionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  testInputGroup: {
    marginBottom: 10,
  },
  testInputLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  testTextInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.textPrimary,
    fontSize: 14,
  },
  testInputRow: {
    flexDirection: 'row',
  },
  testCardNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
  },
  testCardNoticeText: {
    color: '#BAE6FD',
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
});
