import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../../theme/colors';
import { Header } from '../../components/common/Header';
import { SpotCard, ParkingSpotData } from '../../components/driver/SpotCard';
import { MapPlaceholder } from '../../components/driver/MapPlaceholder';
import { DriverMapView } from '../../components/driver/DriverMapView';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { formatCurrency } from '../../utils/formatting';

export const INITIAL_SPOTS: ParkingSpotData[] = [
  {
    id: 'spot-101',
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
    id: 'spot-102',
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
    id: 'spot-103',
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
    id: 'spot-104',
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'affordable' | 'nearby'>('all');
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpotData | null>(INITIAL_SPOTS[0]);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [bookingHours, setBookingHours] = useState(2);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  const filteredSpots = INITIAL_SPOTS.filter((spot) => {
    const matchesSearch =
      spot.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spot.address.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedFilter === 'affordable') return spot.hourly_rate <= 80;
    if (selectedFilter === 'nearby') return (spot.distance_miles ?? 999) <= 1.0;
    return true;
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleBookPress = (spot: ParkingSpotData) => {
    setSelectedSpot(spot);
    setBookingConfirmed(false);
    setBookingModalVisible(true);
  };

  const handleConfirmBooking = () => {
    setBookingConfirmed(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    const timer = setTimeout(() => {
      setBookingModalVisible(false);
      setBookingConfirmed(false);
    }, 1800);
    if (typeof (timer as any).unref === 'function') {
      (timer as any).unref();
    }
    timerRef.current = timer;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <Header />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
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
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

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
              All Spots ({INITIAL_SPOTS.length})
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

        {/* Interactive Map View with Custom Spot Markers */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Interactive Map</Text>
          <Badge label="Custom Markers" variant="driver" />
        </View>

        <DriverMapView
          testID="driver-native-map"
          spots={filteredSpots}
          selectedSpotId={selectedSpot?.id}
          onSelectSpot={(spot) => setSelectedSpot(spot)}
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
          onSelectSpot={(spot) => setSelectedSpot(spot)}
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
            onPress={() => setSelectedSpot(spot)}
            onBookPress={() => handleBookPress(spot)}
          />
        ))}

        {filteredSpots.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyTitle}>No Parking Spots Found</Text>
            <Text style={styles.emptySubtitle}>
              Try adjusting your search terms or expanding your filter range.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Booking Bottom Sheet / Modal */}
      <Modal
        visible={bookingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBookingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent} testID="booking-modal">
            {bookingConfirmed ? (
              <View style={styles.confirmationView} testID="booking-confirmation-view">
                <Text style={styles.confirmIcon}>✅</Text>
                <Text style={styles.confirmTitle}>Reservation Locked!</Text>
                <Text style={styles.confirmSubtitle}>
                  ₹{(selectedSpot?.hourly_rate ?? 0) * bookingHours} held in Razorpay Escrow.
                  Your spot is reserved for {bookingHours} hours.
                </Text>
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
                    style={styles.closeModalBtn}
                  >
                    <Text style={styles.closeModalText}>✕</Text>
                  </TouchableOpacity>
                </View>

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
                  <Text style={styles.escrowNoticeText}>
                    🔒 Razorpay Smart Escrow: Funds release automatically upon completed check-in.
                  </Text>
                </View>

                <Button
                  testID="confirm-booking-btn"
                  title={`Confirm & Reserve (${formatCurrency(
                    (selectedSpot?.hourly_rate ?? 0) * bookingHours
                  )})`}
                  variant="primary"
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
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    padding: 0,
  },
  clearSearch: {
    color: colors.textMuted,
    fontSize: 14,
    paddingHorizontal: 6,
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
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
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
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 40,
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalText: {
    color: colors.textSecondary,
    fontWeight: '700',
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  durationBtnActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
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
    backgroundColor: colors.card,
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
    fontSize: 15,
    fontWeight: '700',
  },
  totalValue: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '800',
  },
  escrowNotice: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  escrowNoticeText: {
    fontSize: 11,
    color: '#93C5FD',
    lineHeight: 16,
  },
  confirmationView: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  confirmIcon: {
    fontSize: 50,
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  confirmSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
