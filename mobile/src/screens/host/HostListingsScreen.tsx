import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { formatCurrency, calculateHostSplit } from '../../utils/formatting';
import { useAuth } from '../../context/AuthContext';
import { createSpot, toggleSpotPause, fetchMySpots } from '../../services/spotService';
import { connectSocket, onSpotAdded, onSpotUpdated } from '../../services/socketService';

export const DEFAULT_HOST_COORDS = {
  latitude: 12.9716,
  longitude: 77.5946,
};

const CYBER_DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0B0F19' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B0F19' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8892B0' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#CCD6F6' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#00F5FF' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#111827' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#10B981' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1F2937' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#111827' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9CA3AF' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#374151' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1F2937' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#00F5FF' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1F2937' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#00F5FF' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#050811' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4F46E5' }],
  },
];

export interface HostListingItem {
  id: string;
  title: string;
  address: string;
  hourly_rate: number;
  is_active: boolean;
  total_bookings: number;
  lifetime_earnings: number;
}

export const HostListingsScreen: React.FC = () => {
  const { userToken } = useAuth();
  const [listings, setListings] = useState<HostListingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const isMountedRef = useRef(true);

  // New Spot Form State
  const [newTitle, setNewTitle] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newRate, setNewRate] = useState('100');

  // Exact Geospatial Pin-Drop State
  const [pinCoords, setPinCoords] = useState<{ latitude: number; longitude: number }>(
    DEFAULT_HOST_COORDS
  );
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const mapRef = useRef<MapView | null>(null);

  /**
   * Fetches live user-scoped spots owned by the authenticated host via GET /spots/me
   */
  const loadMySpots = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await fetchMySpots(userToken);
      if (isMountedRef.current && res.success && Array.isArray(res.spots)) {
        setListings(res.spots);
      }
    } catch {
      // Keep existing state
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [userToken]);

  useEffect(() => {
    isMountedRef.current = true;
    loadMySpots();

    // Attach real-time WebSocket listeners
    connectSocket({ token: userToken });

    const unsubAdded = onSpotAdded((rawSpot: any) => {
      if (!isMountedRef.current || !rawSpot?.id) return;
      setListings((prev) => {
        const exists = prev.some((s) => s.id === rawSpot.id);
        if (exists) return prev;
        const newListing: HostListingItem = {
          id: rawSpot.id,
          title: rawSpot.title,
          address: rawSpot.address,
          hourly_rate: parseFloat(rawSpot.hourly_rate || 80),
          is_active: rawSpot.is_active !== undefined ? Boolean(rawSpot.is_active) : true,
          total_bookings: 0,
          lifetime_earnings: 0,
        };
        return [newListing, ...prev];
      });
    });

    const unsubUpdated = onSpotUpdated((data: { id: string; is_active: boolean; [key: string]: any }) => {
      if (!isMountedRef.current || !data?.id) return;
      setListings((prev) =>
        prev.map((s) => (s.id === data.id ? { ...s, is_active: data.is_active } : s))
      );
    });

    return () => {
      isMountedRef.current = false;
      unsubAdded();
      unsubUpdated();
    };
  }, [userToken, loadMySpots]);

  const totalEarnings = listings.reduce((sum, spot) => sum + (spot.lifetime_earnings || 0), 0);
  const { hostShare } = calculateHostSplit(totalEarnings);
  const activeCount = listings.filter((l) => l.is_active).length;

  const toggleListingActive = async (id: string) => {
    const listing = listings.find((l) => l.id === id);
    if (!listing) return;
    const targetStatus = !listing.is_active;

    // Optimistic UI toggle
    setListings((prev) =>
      prev.map((l) => (l.id === id ? { ...l, is_active: targetStatus } : l))
    );

    // Call backend API to broadcast spot_updated via WebSocket
    try {
      await toggleSpotPause(id, targetStatus, userToken);
    } catch {
      // Revert if API fails
      setListings((prev) =>
        prev.map((l) => (l.id === id ? { ...l, is_active: !targetStatus } : l))
      );
    }
  };

  /**
   * Reverse geocodes coordinates to auto-populate the address field
   */
  const reverseGeocode = async (coords: { latitude: number; longitude: number }) => {
    try {
      const results = await Location.reverseGeocodeAsync(coords);
      if (results && results.length > 0) {
        const item = results[0];
        const formatted = [item.name, item.street, item.district || item.subregion, item.city]
          .filter(Boolean)
          .join(', ');
        if (formatted) {
          setNewAddress(formatted);
        }
      }
    } catch {
      // Ignore geocode error
    }
  };

  /**
   * Updates pin coordinates and triggers reverse geocode
   */
  const handleUpdateCoordinates = (coords: { latitude: number; longitude: number }) => {
    setPinCoords(coords);
    reverseGeocode(coords);
  };

  /**
   * Obtains high-accuracy GPS coordinates via Expo Location and centers map pin
   */
  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    setCreateError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCreateError('Location permission denied. Please enable GPS permissions.');
        setIsLocating(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (loc?.coords) {
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setPinCoords(coords);
        reverseGeocode(coords);

        if (mapRef.current) {
          mapRef.current.animateToRegion(
            {
              ...coords,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            },
            600
          );
        }
      }
    } catch (err: any) {
      setCreateError(err.message || 'Unable to retrieve current location');
    } finally {
      setIsLocating(false);
    }
  };

  /**
   * Submits exact driveway pin coordinates to Express POST /spots
   */
  const handleAddSpot = async () => {
    if (!newTitle.trim() || !newAddress.trim()) {
      setCreateError('Please provide both spot title and address.');
      return;
    }

    const rate = parseInt(newRate, 10) || 50;
    setIsSubmitting(true);
    setCreateError(null);

    try {
      const res = await createSpot(
        {
          title: newTitle.trim(),
          address: newAddress.trim(),
          latitude: pinCoords.latitude,
          longitude: pinCoords.longitude,
          hourly_rate: rate,
          is_active: true,
        },
        userToken
      );

      const spotId = res.success && res.spot?.id ? res.spot.id : `spot-host-${Date.now()}`;
      const newSpot: HostListingItem = {
        id: spotId,
        title: newTitle.trim(),
        address: newAddress.trim(),
        hourly_rate: rate,
        is_active: true,
        total_bookings: 0,
        lifetime_earnings: 0,
      };

      setListings([newSpot, ...listings]);
      setNewTitle('');
      setNewAddress('');
      setNewRate('100');
      setAddModalVisible(false);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to publish spot to network');
    } finally {
      setIsSubmitting(false);
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
            onRefresh={() => loadMySpots(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* KPI Section */}
        <View style={styles.kpiRow}>
          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Net Host Earnings (80%)</Text>
            <Text style={styles.kpiValue} testID="host-kpi-earnings">
              {formatCurrency(hostShare)}
            </Text>
            <Text style={styles.kpiSub}>Auto-settled to Razorpay</Text>
          </Card>

          <Card style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Active Listings</Text>
            <Text style={styles.kpiValue} testID="host-kpi-active">
              {activeCount} / {listings.length}
            </Text>
            <Text style={styles.kpiSub}>Live on PostGIS</Text>
          </Card>
        </View>

        {/* Razorpay Escrow Status Banner */}
        <View style={styles.payoutCard}>
          <View style={styles.payoutLeft}>
            <Text style={styles.payoutTitle}>Razorpay Route Connected</Text>
            <Text style={styles.payoutSubtitle}>
              Linked Account: acc_ghost_host_882 • Escrow 80/20 active
            </Text>
          </View>
          <Badge label="INSTANT PAYOUTS" variant="success" />
        </View>

        {/* Section Header with Add Button */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Your Parking Spaces</Text>
            <Text style={styles.sectionSubtitle}>Manage rates and real-time availability</Text>
          </View>

          <TouchableOpacity
            testID="add-spot-button"
            activeOpacity={0.8}
            onPress={() => setAddModalVisible(true)}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>+ Add Spot</Text>
          </TouchableOpacity>
        </View>

        {/* Listings List */}
        {isLoading ? (
          <View style={styles.loadingContainer} testID="host-listings-loading">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Fetching your listings...</Text>
          </View>
        ) : listings.length === 0 ? (
          <View style={styles.emptyContainer} testID="host-listings-empty">
            <Ionicons name="car-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No parking spots listed yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the "+ Add Spot" button above to publish your driveway or parking slot to the live network.
            </Text>
          </View>
        ) : (
          listings.map((spot) => {
            const split = calculateHostSplit(spot.hourly_rate);
            return (
              <Card key={spot.id} testID={`listing-card-${spot.id}`} style={styles.listingCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleArea}>
                    <Text style={styles.spotTitle}>{spot.title}</Text>
                    <Text style={styles.spotAddress}>{spot.address}</Text>
                  </View>

                  <View style={styles.switchWrapper}>
                    <Text style={styles.switchLabel}>
                      {spot.is_active ? 'Available' : 'Paused'}
                    </Text>
                    <Switch
                      testID={`switch-${spot.id}`}
                      value={spot.is_active}
                      onValueChange={() => toggleListingActive(spot.id)}
                      trackColor={{ false: colors.border, true: 'rgba(6, 182, 212, 0.5)' }}
                      thumbColor={spot.is_active ? colors.primary : colors.textMuted}
                    />
                  </View>
                </View>

                {/* Pricing & Split Breakdown */}
                <View style={styles.splitBox}>
                  <View style={styles.splitItem}>
                    <Text style={styles.splitLabel}>Driver Pays</Text>
                    <Text style={styles.splitRate}>{formatCurrency(spot.hourly_rate)}/hr</Text>
                  </View>
                  <View style={styles.splitDivider} />
                  <View style={styles.splitItem}>
                    <Text style={styles.splitLabel}>You Earn (80%)</Text>
                    <Text style={styles.splitPayout}>{formatCurrency(split.hostShare)}/hr</Text>
                  </View>
                  <View style={styles.splitDivider} />
                  <View style={styles.splitItem}>
                    <Text style={styles.splitLabel}>Bookings</Text>
                    <Text style={styles.splitStat}>{spot.total_bookings}</Text>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Add Spot Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent} testID="add-spot-modal">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>List a New Parking Space</Text>
              <TouchableOpacity
                testID="close-add-modal"
                onPress={() => setAddModalVisible(false)}
                style={styles.closeModalBtn}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {createError && (
              <View style={styles.errorBanner} testID="add-spot-error-banner">
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{createError}</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <Text style={styles.inputLabel}>Spot Title / Name</Text>
              <TextInput
                testID="new-spot-title-input"
                style={styles.input}
                placeholder="e.g. Koramangala Covered Driveway"
                placeholderTextColor={colors.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              {/* Interactive Driveway Pin-Drop Map Header */}
              <View style={styles.mapSectionHeader}>
                <Text style={styles.inputLabel}>Pin Driveway Location</Text>
                <TouchableOpacity
                  testID="use-current-location-btn"
                  onPress={handleUseCurrentLocation}
                  disabled={isLocating}
                  style={styles.locationGpsBtn}
                  activeOpacity={0.8}
                >
                  {isLocating ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="navigate" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                      <Text style={styles.locationGpsBtnText}>Use Current Location</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Interactive MapView with Draggable Marker */}
              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  testID="host-pin-map"
                  provider={PROVIDER_DEFAULT}
                  style={styles.pinMap}
                  customMapStyle={CYBER_DARK_MAP_STYLE}
                  initialRegion={{
                    latitude: pinCoords.latitude,
                    longitude: pinCoords.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }}
                  onPress={(e) => handleUpdateCoordinates(e.nativeEvent.coordinate)}
                >
                  <Marker
                    testID="host-draggable-pin"
                    key="host-draggable-driveway-marker"
                    coordinate={pinCoords}
                    draggable
                    tracksViewChanges={false}
                    onDragEnd={(e) => handleUpdateCoordinates(e.nativeEvent.coordinate)}
                    pinColor="#00F5FF"
                    title="Driveway Pin"
                    description="Drag to exact driveway or parking slot"
                  />
                </MapView>
              </View>

              {/* Exact Coordinate Display Badge */}
              <View style={styles.coordsDisplayBox} testID="selected-coords-display">
                <Ionicons name="location-outline" size={14} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.coordsValueText}>
                  {pinCoords.latitude.toFixed(6)}, {pinCoords.longitude.toFixed(6)}
                </Text>
                <Text style={styles.coordsTipText}>• Drag pin or tap to position</Text>
              </View>

              <Text style={styles.inputLabel}>Address or Landmark</Text>
              <TextInput
                testID="new-spot-address-input"
                style={styles.input}
                placeholder="e.g. 5th Block, 17th Main Rd, Koramangala"
                placeholderTextColor={colors.textMuted}
                value={newAddress}
                onChangeText={setNewAddress}
              />

              <Text style={styles.inputLabel}>Hourly Rate (₹ INR)</Text>
              <TextInput
                testID="new-spot-rate-input"
                style={styles.input}
                placeholder="e.g. 80"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={newRate}
                onChangeText={setNewRate}
              />

              <View style={styles.splitPreview}>
                <Text style={styles.previewText}>
                  At ₹{newRate || 0}/hr, you receive ₹
                  {Math.round((parseInt(newRate, 10) || 0) * 0.8)}/hr deposited via Razorpay Route.
                </Text>
              </View>

              <Button
                testID="submit-add-spot-btn"
                title={isSubmitting ? 'Publishing Spot...' : 'Publish Space to Live Network'}
                loading={isSubmitting}
                variant="primary"
                onPress={handleAddSpot}
              />
            </ScrollView>
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
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    padding: 16,
  },
  kpiLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  kpiSub: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },
  payoutCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 18,
  },
  payoutLeft: {
    flex: 1,
    marginRight: 10,
  },
  payoutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DDD6FE',
    marginBottom: 2,
  },
  payoutSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addButtonText: {
    color: '#090D16',
    fontWeight: '700',
    fontSize: 13,
  },
  listingCard: {
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  cardTitleArea: {
    flex: 1,
    marginRight: 12,
  },
  spotTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  spotAddress: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  switchWrapper: {
    alignItems: 'flex-end',
  },
  switchLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 2,
  },
  splitBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splitItem: {
    flex: 1,
    alignItems: 'center',
  },
  splitLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  splitRate: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  splitPayout: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  splitStat: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  splitDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
    maxHeight: '90%',
    borderTopWidth: 1,
    borderColor: colors.borderLight,
  },
  modalScroll: {
    maxHeight: 520,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
  mapSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  locationGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 245, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.3)',
  },
  locationGpsBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  mapContainer: {
    height: 200,
    width: '100%',
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#090D16',
    marginVertical: 4,
  },
  pinMap: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  coordsDisplayBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  coordsValueText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  coordsTipText: {
    color: colors.textMuted,
    fontSize: 11,
    marginLeft: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  closeModalBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 14,
  },
  splitPreview: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  previewText: {
    fontSize: 12,
    color: colors.primary,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 12,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
});
