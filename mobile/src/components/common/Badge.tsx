import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import colors from '../../theme/colors';

interface BadgeProps {
  label: string;
  variant?: 'driver' | 'host' | 'success' | 'warning' | 'danger' | 'neutral';
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  testID?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  style,
  textStyle,
  icon,
  testID,
}) => {
  const getBadgeStyle = (): ViewStyle => {
    switch (variant) {
      case 'driver':
        return styles.driver;
      case 'host':
        return styles.host;
      case 'success':
        return styles.success;
      case 'warning':
        return styles.warning;
      case 'danger':
        return styles.danger;
      case 'neutral':
      default:
        return styles.neutral;
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'driver':
        return styles.textDriver;
      case 'host':
        return styles.textHost;
      case 'success':
        return styles.textSuccess;
      case 'warning':
        return styles.textWarning;
      case 'danger':
        return styles.textDanger;
      case 'neutral':
      default:
        return styles.textNeutral;
    }
  };

  return (
    <View testID={testID} style={[styles.badge, getBadgeStyle(), style]}>
      {icon}
      <Text style={[styles.text, getTextStyle(), textStyle]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  driver: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.4)',
  },
  host: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  success: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  warning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  danger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  neutral: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textDriver: {
    color: '#38BDF8',
  },
  textHost: {
    color: '#A78BFA',
  },
  textSuccess: {
    color: '#34D399',
  },
  textWarning: {
    color: '#FBBF24',
  },
  textDanger: {
    color: '#F87171',
  },
  textNeutral: {
    color: colors.textSecondary,
  },
});
