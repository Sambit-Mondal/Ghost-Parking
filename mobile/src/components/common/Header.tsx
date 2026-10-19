import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
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
  const { user, activePersona, togglePersona } = useAuth();

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
            <Text style={styles.ghostIcon}>👻</Text>
            <View>
              <Text style={styles.brandName}>Ghost Parking</Text>
              <Text style={styles.brandTagline}>Urban Spatial Network</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.right}>
        {showPersonaToggle && (
          <TouchableOpacity
            testID="header-persona-toggle"
            activeOpacity={0.8}
            onPress={togglePersona}
            style={styles.personaButton}
          >
            <Badge
              label={activePersona === 'driver' ? '🚗 Driver' : '🏠 Host'}
              variant={activePersona === 'driver' ? 'driver' : 'host'}
            />
          </TouchableOpacity>
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
  ghostIcon: {
    fontSize: 26,
    marginRight: 10,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  personaButton: {
    marginRight: 4,
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
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
});
