import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_DEFAULT } from 'react-native-maps';
import colors from '../../theme/colors';
import { ParkingSpotData } from './SpotCard';
import { formatCurrency } from '../../utils/formatting';

interface DriverMapViewProps {
  spots: ParkingSpotData[];
  selectedSpotId?: string;
  onSelectSpot: (spot: ParkingSpotData) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  testID?: string;
}

// Cyberpunk dark theme map styling for Google Maps on Android/iOS
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

export const DriverMapView: React.FC<DriverMapViewProps> = ({
  spots,
  selectedSpotId,
  onSelectSpot,
  userLocation,
  testID = 'driver-map-view',
}) => {
  const mapRef = useRef<MapView | null>(null);

  // Default region centered around central Bengaluru spots
  const initialRegion: Region = {
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  useEffect(() => {
    if (selectedSpotId && mapRef.current) {
      const spot = spots.find((s) => s.id === selectedSpotId);
      if (spot) {
        mapRef.current.animateToRegion(
          {
            latitude: spot.latitude,
            longitude: spot.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          },
          600
        );
      }
    }
  }, [selectedSpotId, spots]);

  const handleRecenter = () => {
    if (!mapRef.current) return;
    if (userLocation) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        500
      );
    } else if (spots.length > 0) {
      mapRef.current.animateToRegion(initialRegion, 500);
    }
  };

  return (
    <View style={styles.container} testID={testID}>
      <MapView
        ref={mapRef}
        testID="native-map"
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        customMapStyle={CYBER_DARK_MAP_STYLE}
        showsUserLocation={!!userLocation}
        showsMyLocationButton={false}
        showsCompass={true}
      >
        {spots.map((spot) => {
          const isSelected = spot.id === selectedSpotId;

          return (
            <Marker
              key={spot.id}
              testID={`map-marker-${spot.id}`}
              coordinate={{
                latitude: spot.latitude,
                longitude: spot.longitude,
              }}
              title={spot.title}
              description={`${formatCurrency(spot.hourly_rate)}/hr • ${spot.available_slots ?? 1} slots left`}
              pinColor={isSelected ? '#00F5FF' : '#3B82F6'}
              tracksViewChanges={false}
              onPress={() => onSelectSpot(spot)}
            />
          );
        })}
      </MapView>

      {/* Map Control Buttons */}
      <View style={styles.controlsOverlay}>
        <TouchableOpacity
          testID="map-recenter-btn"
          style={styles.controlBtn}
          onPress={handleRecenter}
          activeOpacity={0.8}
        >
          <Text style={styles.controlBtnText}>🎯</Text>
        </TouchableOpacity>
      </View>

      {/* Selected Spot Quick Header Overlay */}
      {selectedSpotId && (
        <View style={styles.activeSpotBar}>
          <Text style={styles.activeSpotIndicator}>●</Text>
          <Text style={styles.activeSpotText} numberOfLines={1}>
            Selected: {spots.find((s) => s.id === selectedSpotId)?.title}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0B0F19',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.25)',
    marginVertical: 12,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerSelected: {
    transform: [{ scale: 1.15 }],
    zIndex: 999,
  },
  markerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 4,
  },
  markerPillSelected: {
    backgroundColor: '#00F5FF',
    borderColor: '#FFFFFF',
    shadowColor: '#00F5FF',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  markerIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  markerPrice: {
    color: '#F9FAFB',
    fontSize: 11,
    fontWeight: '700',
  },
  markerPriceSelected: {
    color: '#0B0F19',
    fontWeight: '800',
  },
  markerArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 0,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#111827',
    alignSelf: 'center',
  },
  markerArrowSelected: {
    borderTopColor: '#00F5FF',
  },
  calloutCard: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 10,
    width: 200,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.4)',
  },
  calloutTitle: {
    color: '#F9FAFB',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  calloutAddress: {
    color: '#9CA3AF',
    fontSize: 11,
    marginBottom: 6,
  },
  calloutFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calloutRate: {
    color: '#00F5FF',
    fontSize: 12,
    fontWeight: '700',
  },
  calloutSlots: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },
  controlsOverlay: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'column',
    gap: 8,
  },
  controlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  controlBtnText: {
    fontSize: 16,
  },
  activeSpotBar: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(11, 15, 25, 0.85)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.25)',
  },
  activeSpotIndicator: {
    color: '#00F5FF',
    fontSize: 10,
    marginRight: 6,
  },
  activeSpotText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
