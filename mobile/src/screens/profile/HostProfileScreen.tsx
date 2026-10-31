import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';

export const HostProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <Header title="Host Profile" subtitle="Payout Accounts & Bay Management" showPersonaToggle={false} />

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
                <Text style={styles.avatarInitial}>{user?.name?.charAt(0) || 'H'}</Text>
              </View>
            )}

            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || 'Verified Space Host'}</Text>
              <Text style={styles.userEmail}>{user?.email || 'host@ghostparking.com'}</Text>
              <View style={styles.badgeRow}>
                <Badge label="Host Account" variant="host" />
              </View>
            </View>
          </View>
        </Card>

        {/* Razorpay Escrow & Payout Details */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Escrow Payout Routing</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Ionicons name="card-outline" size={18} color={colors.primary} />
              <Text style={styles.infoLabel}>Razorpay Route Account</Text>
            </View>
            <Text style={styles.infoValue}>
              {user?.razorpayAccountId || 'acc_ghost_host_882'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Ionicons name="pie-chart-outline" size={18} color={colors.success} />
              <Text style={styles.infoLabel}>Host Revenue Share</Text>
            </View>
            <Text style={styles.infoValue}>80% Net per Hour</Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Ionicons name="flash-outline" size={18} color={colors.warning} />
              <Text style={styles.infoLabel}>Settlement Speed</Text>
            </View>
            <Text style={styles.infoValue}>Instant Upon Driver Check-In</Text>
          </View>
        </Card>

        {/* Security & Access */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Security & Host Access</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Ionicons name="business-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.infoLabel}>Authorized Capabilities</Text>
            </View>
            <Text style={styles.infoValue}>PostGIS Spot Publishing</Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
              <Text style={styles.infoLabel}>Role Authorization</Text>
            </View>
            <Text style={styles.infoValue}>Host (Strict Enforced)</Text>
          </View>
        </Card>

        {/* Sign Out Button */}
        <View style={styles.actionWrapper}>
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
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  userCard: {
    padding: 18,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: colors.hostBadge,
  },
  avatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.hostBadge,
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    marginTop: 8,
  },
  sectionCard: {
    padding: 18,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  actionWrapper: {
    marginTop: 8,
  },
});

