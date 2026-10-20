import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, Persona } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import colors from '../../theme/colors';

export const LoginScreen: React.FC = () => {
  const { login, loginWithSSO } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleEmailLogin = async (role: Persona = 'driver') => {
    setLoading(true);
    await login(email || 'driver@ghostparking.com', role);
    setLoading(false);
  };

  const handleSSO = async (provider: 'google' | 'apple') => {
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
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            {/* Header Brand */}
            <View style={styles.brandContainer}>
              <View style={styles.ghostCircle}>
                <Text style={styles.ghostEmoji}>👻</Text>
              </View>
              <Text style={styles.title}>Ghost Parking</Text>
              <Text style={styles.subtitle}>
                Invisible infrastructure. Instant urban parking.
              </Text>
            </View>

            {/* Email Input */}
            <View style={styles.formContainer}>
              <Text style={styles.inputLabel}>Email or Mobile Number</Text>
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

              <Button
                testID="login-continue-btn"
                title="Continue with Email"
                onPress={() => handleEmailLogin('driver')}
                loading={loading}
                style={styles.primaryButton}
              />
            </View>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR SSO LOGIN</Text>
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
              <Text style={styles.quickStartTitle}>QUICK DEMO PERSONA</Text>
              <View style={styles.quickStartButtons}>
                <Button
                  testID="demo-driver-btn"
                  title="🚗 Enter as Driver"
                  size="sm"
                  variant="primary"
                  onPress={() => handleEmailLogin('driver')}
                  style={styles.personaDemoBtn}
                />
                <Button
                  testID="demo-host-btn"
                  title="🏠 Enter as Host"
                  size="sm"
                  variant="host"
                  onPress={() => handleEmailLogin('host')}
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
    marginBottom: 36,
  },
  ghostCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  ghostEmoji: {
    fontSize: 34,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  formContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  primaryButton: {
    marginTop: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    paddingHorizontal: 12,
    letterSpacing: 0.5,
  },
  ssoContainer: {
    gap: 12,
    marginBottom: 28,
  },
  ssoButton: {
    width: '100%',
  },
  quickStartCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
  },
  quickStartTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
    marginBottom: 12,
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
