import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ViewStyle } from 'react-native';
import colors from '../../theme/colors';
import { ParkingSpotData } from './SpotCard';

interface MapPlaceholderProps {
  spots: ParkingSpotData[];
  selectedSpotId?: string;
  onSelectSpot: (spot: ParkingSpotData) => void;
  testID?: string;
}

const { width } = Dimensions.get('window');

export const MapPlaceholder: React.FC<MapPlaceholderProps> = ({
  spots,
  selectedSpotId,
  onSelectSpot,
  testID,
}) => {
  return (
    <View testID={testID} style={styles.container}>
      {/* Stylized Grid Lines for High-tech Urban Map Aesthetics */}
      <View style={styles.gridOverlay}>
        <View style={[styles.gridLineHorizontal, { top: '25%' }]} />
        <View style={[styles.gridLineHorizontal, { top: '50%' }]} />
        <View style={[styles.gridLineHorizontal, { top: '75%' }]} />
        <View style={[styles.gridLineVertical, { left: '30%' }]} />
        <View style={[styles.gridLineVertical, { left: '70%' }]} />

        {/* Pulse Radar Circles */}
        <View style={styles.radarOuter} />
        <View style={styles.radarMiddle} />
      </View>

      {/* Driver Current Location Indicator (Center) */}
      <View style={styles.driverPin}>
        <View style={styles.driverPulse} />
        <View style={styles.driverDot} />
        <Text style={styles.driverLabel}>You (Bangalore MG Rd)</Text>
      </View>

      {/* Render Spot Pins based on coordinates offset */}
      {spots.map((spot, index) => {
        const isSelected = spot.id === selectedSpotId;
        // Position pins artistically around the center
        const positions: ViewStyle[] = [
          { top: '22%', left: '25%' },
          { top: '35%', right: '22%' },
          { bottom: '38%', left: '38%' },
          { bottom: '26%', right: '30%' },
        ];
        const pos = positions[index % positions.length];

        return (
          <TouchableOpacity
            key={spot.id}
            testID={`map-pin-${spot.id}`}
            activeOpacity={0.8}
            onPress={() => onSelectSpot(spot)}
            style={[styles.spotPin, pos, isSelected && styles.selectedSpotPin]}
          >
            <Text style={styles.pinIcon}>🅿️</Text>
            <View style={[styles.pinBadge, isSelected && styles.selectedPinBadge]}>
              <Text style={[styles.pinPrice, isSelected && styles.selectedPinPrice]}>
                ₹{spot.hourly_rate}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={styles.mapWatermark}>
        <Text style={styles.watermarkText}>POSTGIS SPATIAL RADAR ACTIVE (5-MILE RADIUS)</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 280,
    width: '100%',
    backgroundColor: '#070C18',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.15,
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.primary,
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.primary,
  },
  radarOuter: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: colors.primary,
    alignSelf: 'center',
    top: 20,
  },
  radarMiddle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignSelf: 'center',
    top: 70,
  },
  driverPin: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  driverPulse: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  driverDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  driverLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#93C5FD',
    marginTop: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  spotPin: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 20,
  },
  selectedSpotPin: {
    transform: [{ scale: 1.15 }],
    zIndex: 30,
  },
  pinIcon: {
    fontSize: 18,
  },
  pinBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: 2,
  },
  selectedPinBadge: {
    backgroundColor: colors.primary,
    borderColor: '#FFFFFF',
  },
  pinPrice: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  selectedPinPrice: {
    color: '#090D16',
  },
  mapWatermark: {
    position: 'absolute',
    bottom: 8,
    right: 12,
  },
  watermarkText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
});
