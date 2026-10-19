import React, { createContext, useContext, useState, ReactNode } from 'react';

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

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  activePersona: Persona;
  login: (email: string, role?: Persona) => Promise<void>;
  loginWithSSO: (provider: 'google' | 'apple') => Promise<void>;
  logout: () => void;
  switchPersona: (persona: Persona) => void;
  togglePersona: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_DRIVER: User = {
  id: 'usr_driver_001',
  name: 'Alex Rivera',
  email: 'alex.rivera@example.com',
  role: 'driver',
  phone: '+91 98765 43210',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
};

const DEMO_HOST: User = {
  id: 'usr_host_002',
  name: 'Sarah Chen',
  email: 'sarah.chen@example.com',
  role: 'host',
  phone: '+91 91234 56789',
  razorpayAccountId: 'acc_ghost_host_882',
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(DEMO_DRIVER);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [activePersona, setActivePersona] = useState<Persona>('driver');

  const login = async (email: string, role: Persona = 'driver') => {
    // Simulated authentication
    const selectedUser = role === 'host' ? DEMO_HOST : DEMO_DRIVER;
    setUser({ ...selectedUser, email: email || selectedUser.email });
    setActivePersona(role);
    setIsAuthenticated(true);
  };

  const loginWithSSO = async (provider: 'google' | 'apple') => {
    // Simulated SSO login
    setUser({
      id: `usr_sso_${Date.now()}`,
      name: `${provider === 'apple' ? 'Apple' : 'Google'} User`,
      email: `user@${provider}.com`,
      role: 'driver',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
    });
    setActivePersona('driver');
    setIsAuthenticated(true);
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setActivePersona('driver');
  };

  const switchPersona = (persona: Persona) => {
    setActivePersona(persona);
    if (user) {
      setUser({
        ...user,
        role: persona,
        razorpayAccountId: persona === 'host' ? 'acc_ghost_host_882' : user.razorpayAccountId,
      });
    }
  };

  const togglePersona = () => {
    switchPersona(activePersona === 'driver' ? 'host' : 'driver');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        activePersona,
        login,
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
