import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';

export default function ConsentScreen() {
  const router = useRouter();
  const { setHasCompletedConsent } = useAuth();
  const [isChecked, setIsChecked] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  const requestPermissions = async () => {
    try {
      // Request location permission
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (locationStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required for tracking your runs and territories.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Also request background location for better tracking
      if (Platform.OS !== 'web') {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
          Alert.alert(
            'Background Location',
            'Background location access will improve run tracking accuracy.',
            [{ text: 'OK' }]
          );
        }
      }

      setPermissionsGranted(true);
      Alert.alert('Success', 'Permissions granted successfully!');
    } catch (error) {
      console.error('Permission error:', error);
      Alert.alert('Error', 'Failed to request permissions. Please try again.');
    }
  };

  const handleContinue = async () => {
    if (!permissionsGranted) {
      Alert.alert('Permissions Required', 'Please grant permissions to continue.');
      return;
    }
    if (!isChecked) {
      Alert.alert('Agreement Required', 'Please accept the terms to continue.');
      return;
    }

    await setHasCompletedConsent(true);
    router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={60} color="#4a90d9" />
          <Text style={styles.title}>Welcome to Yugur</Text>
          <Text style={styles.subtitle}>Consent & Permissions</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required Permissions</Text>
          
          <TouchableOpacity
            style={[
              styles.permissionButton,
              permissionsGranted && styles.permissionButtonGranted,
            ]}
            onPress={requestPermissions}
          >
            <View style={styles.permissionContent}>
              <Ionicons
                name="location"
                size={24}
                color={permissionsGranted ? '#4ade80' : '#fff'}
              />
              <View style={styles.permissionText}>
                <Text style={styles.permissionTitle}>GPS / Location</Text>
                <Text style={styles.permissionDesc}>
                  Required for tracking runs and territories
                </Text>
              </View>
            </View>
            {permissionsGranted && (
              <Ionicons name="checkmark-circle" size={24} color="#4ade80" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Terms & Conditions</Text>
          <View style={styles.termsBox}>
            <Text style={styles.termsText}>
              In this application, users can win various cash prizes.
              {"\n\n"}
              The main purpose of this application is to improve health.
              {"\n\n"}
              Cash rewards are optional and only available if the user ranks first on the map and leaderboard.
              {"\n\n"}
              Bonus rewards range from 100,000 to 500,000 UZS.
              {"\n\n"}
              The app will share the user's phone number with other users.
              {"\n\n"}
              Other users can see the name and phone number on the map.
              {"\n\n"}
              This is required because users can sell their territories to others.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setIsChecked(!isChecked)}
          >
            <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
              {isChecked && <Ionicons name="checkmark" size={18} color="#fff" />}
            </View>
            <Text style={styles.checkboxLabel}>
              I have read and accept the terms and conditions
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            (!isChecked || !permissionsGranted) && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!isChecked || !permissionsGranted}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 15,
  },
  subtitle: {
    fontSize: 16,
    color: '#8892b0',
    marginTop: 5,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
  },
  permissionButton: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2d3a5c',
  },
  permissionButtonGranted: {
    borderColor: '#4ade80',
  },
  permissionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  permissionText: {
    marginLeft: 12,
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  permissionDesc: {
    fontSize: 13,
    color: '#8892b0',
    marginTop: 2,
  },
  termsBox: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2d3a5c',
  },
  termsText: {
    fontSize: 14,
    color: '#ccd6f6',
    lineHeight: 22,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#4a90d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4a90d9',
  },
  checkboxLabel: {
    marginLeft: 12,
    fontSize: 14,
    color: '#ccd6f6',
    flex: 1,
  },
  continueButton: {
    backgroundColor: '#4a90d9',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  continueButtonDisabled: {
    backgroundColor: '#2d3a5c',
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
});
