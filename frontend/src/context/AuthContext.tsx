import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';

// Configure notifications to show when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface User {
  id: string;
  phone: string;
  name: string;
  avatar?: string;
  total_distance: number;
  color?: string;
  push_token?: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  hasCompletedConsent: boolean;
  setHasCompletedConsent: (value: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCompletedConsent, setHasCompletedConsentState] = useState(false);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    loadUserData();
    setupNotificationListeners();
    
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  const setupNotificationListeners = () => {
    // Listen for incoming notifications while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data;
      
      // Handle territory invasion notification
      if (data?.type === 'territory_invasion') {
        // Show alert with invasion details
        Alert.alert(
          notification.request.content.title || 'Xabar',
          notification.request.content.body || '',
          [
            { text: 'OK' },
            { 
              text: 'Xaritada ko\'rish', 
              onPress: () => {
                // Navigate to map - handled by response listener
              }
            }
          ]
        );
      }
    });

    // Listen for notification interactions (user tapped on notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      if (data?.type === 'territory_invasion') {
        // User tapped the notification - could navigate to map
        console.log('User tapped invasion notification:', data);
      }
    });
  };

  const loadUserData = async () => {
    try {
      const [userData, consentData] = await Promise.all([
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('hasCompletedConsent'),
      ]);

      if (userData) {
        setUser(JSON.parse(userData));
      }
      if (consentData === 'true') {
        setHasCompletedConsentState(true);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (userData: User) => {
    setUser(userData);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem('user');
  };

  const updateUser = async (userData: User) => {
    setUser(userData);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
  };

  const setHasCompletedConsent = async (value: boolean) => {
    setHasCompletedConsentState(value);
    await AsyncStorage.setItem('hasCompletedConsent', value.toString());
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        updateUser,
        hasCompletedConsent,
        setHasCompletedConsent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
