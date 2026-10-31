import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../../navigation/types';
import { useAuth, Persona } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import colors from '../../theme/colors';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export const RegisterScreen: React.FC = () => {
  let navigation: any;
  try {
    navigation = useNavigation<NavigationProp>();
  } catch {
    navigation = { navigate: () => {} };
  }
  const { register } = useAuth();

  const [selectedRole, setSelectedRole] = useState<Persona>('driver');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleRegister = async () => {
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please enter your full name');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    const result = await register(name, email, password, selectedRole, phone);
    setLoading(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Registration failed. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always">
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            {/* Header Brand */}
            <View style={styles.brandContainer}>
              <View style={styles.ghostCircle}>
                <Ionicons name="location" size={26} color={colors.primary} />
              </View>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>
                Join the decentralized parking network
              </Text>
            </View>

            {/* Role Selection Toggle */}
            <View style={styles.roleToggleCard}>
              <Text style={styles.roleToggleLabel}>SELECT YOUR ROLE</Text>
              <View style={styles.roleToggleRow}>
                <TouchableOpacity
                  testID="role-toggle-driver"
                  style={[
                    styles.roleToggleBtn,
                    selectedRole === 'driver' && styles.roleToggleBtnActiveDriver,
                  ]}
                  onPress={() => setSelectedRole('driver')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="car-outline"
                    size={20}
                    color={selectedRole === 'driver' ? colors.primary : colors.textMuted}
                    style={styles.roleIcon}
                  />
                  <Text
                    style={[
                      styles.roleToggleText,
                      selectedRole === 'driver' && styles.roleToggleTextActive,
                    ]}
                  >
                    I am a Driver
                  </Text>
                  <Text style={styles.roleSubtext}>Find & book spots</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="role-toggle-host"
                  style={[
                    styles.roleToggleBtn,
                    selectedRole === 'host' && styles.roleToggleBtnActiveHost,
                  ]}
                  onPress={() => setSelectedRole('host')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="business-outline"
                    size={20}
                    color={selectedRole === 'host' ? colors.hostBadge : colors.textMuted}
                    style={styles.roleIcon}
                  />
                  <Text
                    style={[
                      styles.roleToggleText,
                      selectedRole === 'host' && styles.roleToggleTextActive,
                    ]}
                  >
                    I am a Host
                  </Text>
                  <Text style={styles.roleSubtext}>Monetize parking</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Banner */}
            {errorMessage && (
              <View style={styles.errorBanner} testID="register-error-banner">
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Form Fields */}
            <View style={styles.formContainer}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                testID="register-name-input"
                style={styles.input}
                placeholder="Jane Doe"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />

              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                testID="register-email-input"
                style={styles.input}
                placeholder="jane@example.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                testID="register-password-input"
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
              <TextInput
                testID="register-phone-input"
                style={styles.input}
                placeholder="+91 98765 43210"
                placeholderTextColor={colors.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              <Button
                testID="register-submit-btn"
                title={`Register as ${selectedRole === 'driver' ? 'Driver' : 'Host'}`}
                onPress={handleRegister}
                loading={loading}
                variant={selectedRole === 'host' ? 'host' : 'primary'}
                style={styles.submitButton}
              />
            </View>

            {/* Navigate to Login Link */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity
                testID="navigate-login-btn"
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.footerLink}>Log In</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ghostCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  ghostEmoji: {
    fontSize: 30,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  roleToggleCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 20,
  },
  roleToggleLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: 'center',
  },
  roleToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleToggleBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  roleToggleBtnActiveDriver: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
  },
  roleToggleBtnActiveHost: {
    borderColor: colors.hostBadge,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
  },
  roleIcon: {
    marginBottom: 4,
  },
  roleToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  roleToggleTextActive: {
    color: colors.textPrimary,
  },
  roleSubtext: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorIcon: {
    fontSize: 14,
  },
  errorText: {
    flex: 1,
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
  },
  formContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 14,
  },
  submitButton: {
    marginTop: 6,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  footerText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});
