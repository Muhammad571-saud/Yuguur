import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';

export default function Index() {
  const router = useRouter();
  const { user, loading, hasCompletedConsent } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!hasCompletedConsent) {
        router.replace('/consent');
      } else if (!user) {
        router.replace('/auth/login');
      } else {
        router.replace('/(tabs)/profile');
      }
    }
  }, [loading, user, hasCompletedConsent]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4a90d9" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
});
