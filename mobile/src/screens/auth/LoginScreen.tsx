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

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC = () => {
  let navigation: any;
  try {
    navigation = useNavigation<NavigationProp>();
  } catch {
    navigation = { navigate: () => {} };
  }
  const { login, loginWithSSO } = useAuth();

  const [selectedRole, setSelectedRole] = useState<Persona>('driver');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleEmailLogin = async (overrideRole?: Persona) => {
    setErrorMessage(null);
    const targetRole = overrideRole || selectedRole;

    if (!email.trim()) {
      setErrorMessage('Please enter your email');
      return;
    }

    setLoading(true);
    // If password provided, perform real Express backend JWT login
    // If password omitted, falls back to demo mode gracefully
    const result = await login(email, password || undefined, targetRole);
    setLoading(false);

    if (result && !result.success) {
      setErrorMessage(result.error || 'Login failed. Please check your credentials.');
    }
  };

  const handleQuickDemoLogin = async (role: Persona) => {
    setErrorMessage(null);
    setSelectedRole(role);
    setLoading(true);
    await login(
      role === 'host' ? 'host.demo@ghostparking.com' : 'driver.demo@ghostparking.com',
      undefined,
      role
    );
    setLoading(false);
  };

  const handleSSO = async (provider: 'google' | 'apple') => {
    setErrorMessage(null);
    setLoading(true);
    await loginWithSSO(provider);
    setLoading(false);
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
              <Text style={styles.title}>Ghost Parking</Text>
              <Text style={styles.subtitle}>
                Invisible infrastructure. Instant urban parking.
              </Text>
            </View>

            {/* Role Selection Toggle */}
            <View style={styles.roleToggleCard}>
              <Text style={styles.roleToggleLabel}>LOG IN AS</Text>
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
                  <Text style={styles.roleSubtext}>Find & park</Text>
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
                  <Text style={styles.roleSubtext}>Manage listings</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Banner */}
            {errorMessage && (
              <View style={styles.errorBanner} testID="login-error-banner">
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Email & Password Input */}
            <View style={styles.formContainer}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                testID="login-email-input"
                style={styles.input}
                placeholder="driver@example.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                testID="login-password-input"
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <Button
                testID="login-continue-btn"
                title={`Log In as ${selectedRole === 'driver' ? 'Driver' : 'Host'}`}
                onPress={() => handleEmailLogin()}
                loading={loading}
                variant={selectedRole === 'host' ? 'host' : 'primary'}
                style={styles.primaryButton}
              />
            </View>

            {/* Navigate to Register */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity
                testID="navigate-register-btn"
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={styles.registerLink}>Register</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR FAST SIGN-IN</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* SSO Providers */}
            <View style={styles.ssoContainer}>
              <Button
                testID="sso-apple-btn"
                title="Continue with Apple"
                variant="secondary"
                onPress={() => handleSSO('apple')}
                style={styles.ssoButton}
              />
              <Button
                testID="sso-google-btn"
                title="Continue with Google"
                variant="secondary"
                onPress={() => handleSSO('google')}
                style={styles.ssoButton}
              />
            </View>

            {/* Persona Quick Start Demo Buttons */}
            <View style={styles.quickStartCard}>
              <Text style={styles.quickStartTitle}>QUICK DEMO ACCESS</Text>
              <View style={styles.quickStartButtons}>
                <Button
                  testID="demo-driver-btn"
                  title="Enter as Driver"
                  size="sm"
                  variant="primary"
                  onPress={() => handleQuickDemoLogin('driver')}
                  style={styles.personaDemoBtn}
                />
                <Button
                  testID="demo-host-btn"
                  title="Enter as Host"
                  size="sm"
                  variant="host"
                  onPress={() => handleQuickDemoLogin('host')}
                  style={styles.personaDemoBtn}
                />
              </View>
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
    marginBottom: 20,
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
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
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
    lineHeight: 18,
    maxWidth: 280,
  },
  roleToggleCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 16,
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
    padding: 10,
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
    marginBottom: 14,
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
    marginBottom: 12,
  },
  primaryButton: {
    marginTop: 4,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  registerText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  registerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    paddingHorizontal: 12,
    letterSpacing: 0.5,
  },
  ssoContainer: {
    gap: 10,
    marginBottom: 20,
  },
  ssoButton: {
    width: '100%',
  },
  quickStartCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
  },
  quickStartTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
    marginBottom: 10,
  },
  quickStartButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  personaDemoBtn: {
    flex: 1,
  },
});
