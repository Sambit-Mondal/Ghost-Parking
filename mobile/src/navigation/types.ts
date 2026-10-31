import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type DriverTabParamList = {
  DriverMap: undefined;
  DriverBookings: undefined;
  DriverProfile: undefined;
};

export type HostTabParamList = {
  HostListings: undefined;
  HostReservations: undefined;
  HostProfile: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  DriverRoot: NavigatorScreenParams<DriverTabParamList>;
  HostRoot: NavigatorScreenParams<HostTabParamList>;
};
