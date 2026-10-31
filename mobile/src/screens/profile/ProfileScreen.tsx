import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { DriverProfileScreen } from './DriverProfileScreen';
import { HostProfileScreen } from './HostProfileScreen';

export const ProfileScreen: React.FC = () => {
  const { userRole } = useAuth();

  if (userRole === 'host') {
    return <HostProfileScreen />;
  }

  return <DriverProfileScreen />;
};

export default ProfileScreen;
