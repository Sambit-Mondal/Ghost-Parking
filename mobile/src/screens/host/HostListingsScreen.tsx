import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../../theme/colors';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { formatCurrency, calculateHostSplit } from '../../utils/formatting';

export interface HostListingItem {
  id: string;
  title: string;
  address: string;
  hourly_rate: number;
  is_active: boolean;
  total_bookings: number;
  lifetime_earnings: number;
}

export const INITIAL_HOST_LISTINGS: HostListingItem[] = [
  {
    id: 'spot-host-01',
    title: 'MG Road Metro Hub Parking',
    address: 'Near Trinity Metro Station, MG Road, Bengaluru',
    hourly_rate: 80,
    is_active: true,
    total_bookings: 84,
    lifetime_earnings: 20160,
  },
  {
    id: 'spot-host-02',
    title: 'Indiranagar 100ft Rd Garage',
    address: '12th Main Rd, HAL 2nd Stage, Indiranagar',
    hourly_rate: 120,
    is_active: true,
    total_bookings: 42,
    lifetime_earnings: 15120,
  },
  {
    id: 'spot-host-03',
    title: 'Koramangala Tech Park Bay',
    address: '4th Block, 80 Feet Rd, Koramangala',
    hourly_rate: 60,
    is_active: false,
    total_bookings: 29,
    lifetime_earnings: 6960,
  },
];

export const HostListingsScreen: React.FC = () => {
  const [listings, setListings] = useState<HostListingItem[]>(INITIAL_HOST_LISTINGS);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // New Spot Form State
  const [newTitle, setNewTitle] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newRate, setNewRate] = useState('100');

  const totalEarnings = listings.reduce((sum, spot) => sum + spot.lifetime_earnings, 0);
  const { hostShare } = calculateHostSplit(totalEarnings);
  const activeCount = listings.filter((l) => l.is_active).length;

  const toggleListingActive = (id: string) => {
    setListings((prev) =>
      prev.map((l) => (l.id === id ? { ...l, is_active: !l.is_active } : l))
    );
  };

  const handleAddSpot = () => {
    if (!newTitle.trim() || !newAddress.trim()) return;

    const rate = parseInt(newRate, 10) || 50;
    const newSpot: HostListingItem = {
      id: `spot-host-${Date.now()}`,
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
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <Header />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
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
            <Text style={styles.payoutTitle}>💳 Razorpay Route Connected</Text>
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
        {listings.map((spot) => {
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
        })}
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
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Spot Title / Name</Text>
            <TextInput
              testID="new-spot-title-input"
              style={styles.input}
              placeholder="e.g. Koramangala Covered Driveway"
              placeholderTextColor={colors.textMuted}
              value={newTitle}
              onChangeText={setNewTitle}
            />

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
                💡 At ₹{newRate || 0}/hr, you receive ₹
                {Math.round((parseInt(newRate, 10) || 0) * 0.8)}/hr deposited via Razorpay.
              </Text>
            </View>

            <Button
              testID="submit-add-spot-btn"
              title="Publish Space to Live Network"
              variant="primary"
              onPress={handleAddSpot}
            />
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
    borderTopWidth: 1,
    borderColor: colors.borderLight,
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
});
