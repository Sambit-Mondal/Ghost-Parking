import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import colors from '../../theme/colors';
import { Badge } from './Badge';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showPersonaToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showPersonaToggle = true,
}) => {
  const { user, userRole } = useAuth();
  const currentRole = userRole || user?.role || 'driver';

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {title ? (
          <>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </>
        ) : (
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoMarkText}>GP</Text>
            </View>
            <View>
              <Text style={styles.brandName}>GHOST PARKING</Text>
              <Text style={styles.brandTagline}>Spatial Network</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.right}>
        {showPersonaToggle && (
          <View testID="header-persona-toggle" style={styles.personaBadgeWrapper}>
            <Badge
              label={currentRole === 'driver' ? 'Driver' : 'Host'}
              variant={currentRole === 'driver' ? 'driver' : 'host'}
            />
          </View>
        )}

        {user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{user?.name?.charAt(0) || 'U'}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoMarkText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  brandName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  personaBadgeWrapper: {
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
