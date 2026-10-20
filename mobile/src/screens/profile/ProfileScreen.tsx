import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../../theme/colors';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';

export const ProfileScreen: React.FC = () => {
  const { user, activePersona, switchPersona, logout } = useAuth();

  const isDriver = activePersona === 'driver';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <Header title="Account Profile" subtitle="Settings & Persona Mode" showPersonaToggle={false} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* User Card */}
        <Card style={styles.userCard}>
          <View style={styles.userRow}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{user?.name?.charAt(0) || 'U'}</Text>
              </View>
            )}

            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || 'Ghost User'}</Text>
              <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
              <View style={styles.badgeRow}>
                <Badge
                  label={isDriver ? '🚗 Active Driver' : '🏠 Active Host'}
                  variant={isDriver ? 'driver' : 'host'}
                />
              </View>
            </View>
          </View>
        </Card>

        {/* Dual Persona Switch Card */}
        <Card style={styles.personaCard}>
          <View style={styles.personaHeader}>
            <View>
              <Text style={styles.personaTitle}>Active Persona Mode</Text>
              <Text style={styles.personaSub}>
                {isDriver
                  ? 'Currently browsing & reserving parking as a Driver.'
                  : 'Currently managing parking bays & earning as a Host.'}
              </Text>
            </View>
          </View>

          <View style={styles.personaToggleRow}>
            <TouchableOpacity
              testID="persona-select-driver"
              activeOpacity={0.8}
              style={[styles.personaOption, isDriver && styles.personaOptionActive]}
              onPress={() => switchPersona('driver')}
            >
              <Text style={styles.personaIcon}>🚗</Text>
              <Text
                style={[
                  styles.personaOptionText,
                  isDriver && styles.personaOptionTextActive,
                ]}
              >
                Driver View
              </Text>
              <Text style={styles.personaDesc}>Find & Book Spots</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="persona-select-host"
              activeOpacity={0.8}
              style={[styles.personaOption, !isDriver && styles.personaOptionActive]}
              onPress={() => switchPersona('host')}
            >
              <Text style={styles.personaIcon}>🏠</Text>
              <Text
                style={[
                  styles.personaOptionText,
                  !isDriver && styles.personaOptionTextActive,
                ]}
              >
                Host View
              </Text>
              <Text style={styles.personaDesc}>Monetize Parking</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Financial & Escrow Account Card */}
        <Card style={styles.sectionCard}>
          <Text style={styles.cardSectionTitle}>Payment & Escrow System</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Razorpay Network</Text>
            <Badge label="Connected" variant="success" />
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Status</Text>
            <Text style={styles.infoValue}>
              {isDriver ? 'Verified Driver UPI/Card' : 'Razorpay Route Linked'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Linked Identifier</Text>
            <Text style={styles.infoValueMonospace}>
              {user?.razorpayAccountId || 'acc_driver_live_01'}
            </Text>
          </View>

          <View style={styles.splitNoticeBox}>
            <Text style={styles.splitNoticeText}>
              {isDriver
                ? 'ℹ️ All payments are safely protected by Razorpay Escrow until successful check-in.'
                : 'ℹ️ Hosts earn 80% net proceeds per reservation, settled automatically via Razorpay Route.'}
            </Text>
          </View>
        </Card>

        {/* App Settings Card */}
        <Card style={styles.sectionCard}>
          <Text style={styles.cardSectionTitle}>Preferences</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Theme</Text>
            <Text style={styles.infoValue}>Ghost Cyber Dark</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location Precision</Text>
            <Text style={styles.infoValue}>PostGIS High-Accuracy</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>App Version</Text>
            <Text style={styles.infoValue}>v1.0.0-expo51</Text>
          </View>
        </Card>

        {/* Logout Button */}
        <View style={styles.logoutWrapper}>
          <Button
            testID="logout-button"
            title="Sign Out"
            variant="outline"
            onPress={logout}
          />
        </View>
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
  userCard: {
    marginBottom: 16,
    padding: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  personaCard: {
    marginBottom: 16,
    padding: 16,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    backgroundColor: colors.surfaceElevated,
  },
  personaHeader: {
    marginBottom: 14,
  },
  personaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  personaSub: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  personaToggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  personaOption: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  personaOptionActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
  },
  personaIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  personaOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  personaOptionTextActive: {
    color: colors.textPrimary,
  },
  personaDesc: {
    fontSize: 11,
    color: colors.textMuted,
  },
  sectionCard: {
    marginBottom: 16,
    padding: 16,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  infoValueMonospace: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.primary,
  },
  splitNoticeBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  splitNoticeText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  logoutWrapper: {
    marginTop: 8,
  },
});
