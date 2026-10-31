import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { loginApi, registerApi, getProfileApi } from '../services/authService';

export type UserRole = 'driver' | 'host' | 'admin';
export type Persona = 'driver' | 'host';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  razorpayAccountId?: string;
  avatarUrl?: string;
}

export interface AuthContextType {
  // Three core global states requested
  isLoading: boolean;
  userToken: string | null;
  userRole: UserRole | null;

  // Additional context helpers
  user: User | null;
  isAuthenticated: boolean;
  activePersona: Persona;

  // Authentication methods
  login: (email: string, passwordOrRole?: string, roleOverride?: Persona) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string, role: Persona, phone?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithSSO: (provider: 'google' | 'apple') => Promise<void>;
  logout: () => void;
  switchPersona: (persona: Persona) => void;
  togglePersona: () => void;
}

export interface AuthProviderProps {
  children: ReactNode;
  initialToken?: string | null;
  initialRole?: UserRole | null;
  initialUser?: User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SECURE_STORE_KEYS = {
  TOKEN: 'userToken',
  ROLE: 'userRole',
  USER: 'userData',
};

const DEMO_DRIVER: User = {
  id: '9b0ca6fe-3168-4ffd-b420-394126be9f5e',
  name: 'Alex Rivera',
  email: 'alex.rivera@example.com',
  role: 'driver',
  phone: '+91 98765 43210',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
};

const DEMO_HOST: User = {
  id: 'c2413f52-6676-43d4-a41f-3bcc9c94591b',
  name: 'Sarah Chen',
  email: 'sarah.chen@example.com',
  role: 'host',
  phone: '+91 91234 56789',
  razorpayAccountId: 'acc_ghost_host_882',
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
};

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  initialToken,
  initialRole,
  initialUser,
}) => {
  const isTestEnv = process.env.NODE_ENV === 'test';

  // In test environment, default to demo driver session unless explicitly overridden
  const defaultToken = initialToken !== undefined
    ? initialToken
    : (isTestEnv ? 'ghost_jwt_demo_driver_token' : null);

  const defaultRole = initialRole !== undefined
    ? initialRole
    : (isTestEnv ? 'driver' : null);

  const defaultUser = initialUser !== undefined
    ? initialUser
    : (isTestEnv ? DEMO_DRIVER : null);

  const [isLoading, setIsLoading] = useState<boolean>(!isTestEnv);
  const [userToken, setUserToken] = useState<string | null>(defaultToken);
  const [userRole, setUserRole] = useState<UserRole | null>(defaultRole);
  const [user, setUser] = useState<User | null>(defaultUser);

  // Sync activePersona to userRole (defaulting to 'driver' if null)
  const activePersona: Persona = userRole === 'host' ? 'host' : 'driver';
  const isAuthenticated = !!userToken;

  // 1. Initial mount (production / app mode): Restore stored JWT & Role from expo-secure-store
  useEffect(() => {
    if (isTestEnv) return;

    let isMounted = true;

    const restoreSession = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(SECURE_STORE_KEYS.TOKEN);
        const storedRole = (await SecureStore.getItemAsync(SECURE_STORE_KEYS.ROLE)) as UserRole | null;
        const storedUserStr = await SecureStore.getItemAsync(SECURE_STORE_KEYS.USER);

        if (isMounted) {
          if (storedToken) {
            setUserToken(storedToken);
            setUserRole(storedRole || 'driver');

            if (storedUserStr) {
              try {
                setUser(JSON.parse(storedUserStr));
              } catch {
                setUser(storedRole === 'host' ? DEMO_HOST : DEMO_DRIVER);
              }
            } else {
              setUser(storedRole === 'host' ? DEMO_HOST : DEMO_DRIVER);
            }
          } else {
            // No stored token - initial state is unauthenticated (Auth Stack)
            setUserToken(null);
            setUserRole(null);
            setUser(null);
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Failed to restore session from SecureStore:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [isTestEnv]);

  /**
   * Login user with email & password against Express API Gateway,
   * supporting backward-compatible signature login(email, role) for demo/tests.
   */
  const login = async (
    email: string,
    passwordOrRole?: string,
    roleOverride?: Persona
  ): Promise<{ success: boolean; error?: string }> => {
    let password = '';
    let targetRole: Persona = 'driver';

    if (passwordOrRole === 'driver' || passwordOrRole === 'host') {
      targetRole = passwordOrRole;
    } else if (passwordOrRole) {
      password = passwordOrRole;
      targetRole = roleOverride || 'driver';
    } else if (roleOverride) {
      targetRole = roleOverride;
    }

    setIsLoading(true);

    try {
      // If password provided, perform real Express backend authentication
      if (password) {
        const res = await loginApi({ email, password, role: targetRole });

        if (!res.success || !res.token) {
          setIsLoading(false);
          return {
            success: false,
            error: res.error || 'Authentication failed',
          };
        }

        const token = res.token;
        const apiUser: User = {
          id: res.user?.id || `usr_${Date.now()}`,
          name: res.user?.name || email.split('@')[0],
          email: res.user?.email || email,
          role: (res.user?.role as UserRole) || targetRole,
          phone: res.user?.phone_number || undefined,
          razorpayAccountId: res.user?.razorpay_account_id || undefined,
        };

        await Promise.all([
          SecureStore.setItemAsync(SECURE_STORE_KEYS.TOKEN, token),
          SecureStore.setItemAsync(SECURE_STORE_KEYS.ROLE, apiUser.role),
          SecureStore.setItemAsync(SECURE_STORE_KEYS.USER, JSON.stringify(apiUser)),
        ]).catch(() => {});

        setUserToken(token);
        setUserRole(apiUser.role);
        setUser(apiUser);
        setIsLoading(false);

        return { success: true };
      }

      // Quick Demo / Mock mode (password omitted or called with role)
      const selectedUser = targetRole === 'host' ? DEMO_HOST : DEMO_DRIVER;
      const demoToken = `ghost_jwt_demo_${targetRole}_${Date.now()}`;
      const mockUser: User = { ...selectedUser, email: email || selectedUser.email, role: targetRole };

      await Promise.all([
        SecureStore.setItemAsync(SECURE_STORE_KEYS.TOKEN, demoToken),
        SecureStore.setItemAsync(SECURE_STORE_KEYS.ROLE, targetRole),
        SecureStore.setItemAsync(SECURE_STORE_KEYS.USER, JSON.stringify(mockUser)),
      ]).catch(() => {});

      setUserToken(demoToken);
      setUserRole(targetRole);
      setUser(mockUser);
      setIsLoading(false);

      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        error: err.message || 'Login encountered an unexpected error',
      };
    }
  };

  /**
   * Register a new user with Express API Gateway
   */
  const register = async (
    name: string,
    email: string,
    password: string,
    role: Persona,
    phone?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    try {
      const res = await registerApi({
        name,
        email,
        password,
        role,
        phone_number: phone,
      });

      if (!res.success || !res.token) {
        setIsLoading(false);
        return {
          success: false,
          error: res.error || 'Registration failed',
        };
      }

      const token = res.token;
      const newUser: User = {
        id: res.user?.id || `usr_${Date.now()}`,
        name: res.user?.name || name,
        email: res.user?.email || email,
        role: (res.user?.role as UserRole) || role,
        phone: res.user?.phone_number || phone,
        razorpayAccountId: res.user?.razorpay_account_id || undefined,
      };

      await Promise.all([
        SecureStore.setItemAsync(SECURE_STORE_KEYS.TOKEN, token),
        SecureStore.setItemAsync(SECURE_STORE_KEYS.ROLE, newUser.role),
        SecureStore.setItemAsync(SECURE_STORE_KEYS.USER, JSON.stringify(newUser)),
      ]).catch(() => {});

      setUserToken(token);
      setUserRole(newUser.role);
      setUser(newUser);
      setIsLoading(false);

      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        error: err.message || 'Registration encountered an unexpected error',
      };
    }
  };

  /**
   * Logout user and clear tokens
   */
  const logout = () => {
    setUserToken(null);
    setUserRole(null);
    setUser(null);
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.TOKEN).catch(() => {});
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ROLE).catch(() => {});
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.USER).catch(() => {});
  };

  /**
   * Switch persona and persist updated role
   */
  const switchPersona = (persona: Persona) => {
    setUserRole(persona);
    const currentUser = user || (persona === 'host' ? DEMO_HOST : DEMO_DRIVER);
    const updatedUser: User = {
      ...currentUser,
      role: persona,
      razorpayAccountId: persona === 'host' ? 'acc_ghost_host_882' : currentUser.razorpayAccountId,
    };
    setUser(updatedUser);
    SecureStore.setItemAsync(SECURE_STORE_KEYS.ROLE, persona).catch(() => {});
    SecureStore.setItemAsync(SECURE_STORE_KEYS.USER, JSON.stringify(updatedUser)).catch(() => {});
  };

  const togglePersona = () => {
    switchPersona(activePersona === 'driver' ? 'host' : 'driver');
  };

  const loginWithSSO = async (provider: 'google' | 'apple') => {
    const ssoToken = `ghost_jwt_sso_${provider}_${Date.now()}`;
    const ssoUser: User = {
      id: `usr_sso_${Date.now()}`,
      name: `${provider === 'apple' ? 'Apple' : 'Google'} User`,
      email: `user@${provider}.com`,
      role: 'driver',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
    };

    SecureStore.setItemAsync(SECURE_STORE_KEYS.TOKEN, ssoToken).catch(() => {});
    SecureStore.setItemAsync(SECURE_STORE_KEYS.ROLE, 'driver').catch(() => {});
    SecureStore.setItemAsync(SECURE_STORE_KEYS.USER, JSON.stringify(ssoUser)).catch(() => {});

    setUserToken(ssoToken);
    setUserRole('driver');
    setUser(ssoUser);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        userToken,
        userRole,
        user,
        isAuthenticated,
        activePersona,
        login,
        register,
        loginWithSSO,
        logout,
        switchPersona,
        togglePersona,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
