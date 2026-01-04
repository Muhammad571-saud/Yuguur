import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';

export default function ConsentScreen() {
  const router = useRouter();
  const { setHasCompletedConsent } = useAuth();
  const [isChecked, setIsChecked] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'undetermined' | 'granted' | 'denied' | 'blocked'>('undetermined');
  const [isRequesting, setIsRequesting] = useState(false);

  // Check permission status on mount
  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = async () => {
    if (Platform.OS === 'web') {
      setPermissionStatus('granted');
      return;
    }

    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermissionStatus('granted');
      } else if (status === 'denied') {
        // Check if it's permanently denied (blocked)
        const { canAskAgain } = await Location.getForegroundPermissionsAsync();
        setPermissionStatus(canAskAgain ? 'denied' : 'blocked');
      } else {
        setPermissionStatus('undetermined');
      }
    } catch (error) {
      console.error('Error checking permission:', error);
    }
  };

  const requestPermission = async () => {
    if (Platform.OS === 'web') {
      setPermissionStatus('granted');
      return true;
    }

    setIsRequesting(true);
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        setPermissionStatus('granted');
        return true;
      } else if (!canAskAgain) {
        // User selected "Don't ask again"
        setPermissionStatus('blocked');
        showBlockedAlert();
        return false;
      } else {
        // User denied but can ask again
        setPermissionStatus('denied');
        showDeniedAlert();
        return false;
      }
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    } finally {
      setIsRequesting(false);
    }
  };

  const showDeniedAlert = () => {
    Alert.alert(
      'GPS ruxsati kerak',
      'Ilova ishlashi uchun GPS ruxsati majburiy. Iltimos, ruxsat bering.',
      [
        { text: 'Bekor qilish', style: 'cancel' },
        { text: 'Qayta so\'rash', onPress: requestPermission },
      ]
    );
  };

  const showBlockedAlert = () => {
    Alert.alert(
      'GPS ruxsati bloklangan',
      'Siz GPS ruxsatini butunlay rad qildingiz. Ilovani ishlatish uchun sozlamalardan ruxsat bering.',
      [
        { text: 'Bekor qilish', style: 'cancel' },
        { text: 'Sozlamalarga o\'tish', onPress: openSettings },
      ]
    );
  };

  const openSettings = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else if (Platform.OS === 'android') {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
          { data: 'package:' + (await import('expo-application')).then(m => m.applicationId) }
        );
      }
    } catch (error) {
      // Fallback
      Linking.openSettings();
    }
  };

  const handleContinue = async () => {
    // First check checkbox
    if (!isChecked) {
      Alert.alert('Shartlar kerak', 'Davom etish uchun shartlarni qabul qiling.');
      return;
    }

    // If permission not granted yet, request it
    if (permissionStatus !== 'granted') {
      if (permissionStatus === 'blocked') {
        showBlockedAlert();
        return;
      }
      
      const granted = await requestPermission();
      if (!granted) {
        return; // Don't proceed if permission not granted
      }
    }

    // Permission granted, proceed
    try {
      await setHasCompletedConsent(true);
      router.replace('/auth/login');
    } catch (error) {
      console.error('Continue error:', error);
      router.replace('/auth/login');
    }
  };

  const getPermissionIcon = () => {
    switch (permissionStatus) {
      case 'granted':
        return <Ionicons name="checkmark-circle" size={24} color="#4ade80" />;
      case 'denied':
        return <Ionicons name="close-circle" size={24} color="#f59e0b" />;
      case 'blocked':
        return <Ionicons name="ban" size={24} color="#ef4444" />;
      default:
        return <Ionicons name="help-circle" size={24} color="#8892b0" />;
    }
  };

  const getPermissionStatusText = () => {
    switch (permissionStatus) {
      case 'granted':
        return 'Ruxsat berilgan';
      case 'denied':
        return 'Rad etilgan';
      case 'blocked':
        return 'Bloklangan - Sozlamalardan oching';
      default:
        return 'Ruxsat kutilmoqda';
    }
  };

  const getButtonText = () => {
    if (isRequesting) return 'Tekshirilmoqda...';
    if (permissionStatus === 'granted' && isChecked) return 'Davom etish';
    if (permissionStatus === 'blocked') return 'Sozlamalarga o\'tish';
    if (!isChecked) return 'Shartlarni qabul qiling';
    return 'GPS ruxsatini bering';
  };

  const isButtonDisabled = () => {
    return isRequesting;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={60} color="#4a90d9" />
          <Text style={styles.title}>Yugur ilovasiga xush kelibsiz</Text>
          <Text style={styles.subtitle}>Rozilik va ruxsatlar</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Majburiy ruxsatlar</Text>
          
          <TouchableOpacity
            style={[
              styles.permissionButton,
              permissionStatus === 'granted' && styles.permissionButtonGranted,
              permissionStatus === 'blocked' && styles.permissionButtonBlocked,
            ]}
            onPress={permissionStatus === 'blocked' ? openSettings : requestPermission}
            disabled={permissionStatus === 'granted' || isRequesting}
          >
            <View style={styles.permissionContent}>
              <Ionicons
                name="location"
                size={24}
                color={permissionStatus === 'granted' ? '#4ade80' : permissionStatus === 'blocked' ? '#ef4444' : '#fff'}
              />
              <View style={styles.permissionText}>
                <Text style={styles.permissionTitle}>GPS / Joylashuv</Text>
                <Text style={[
                  styles.permissionDesc,
                  permissionStatus === 'blocked' && styles.permissionDescBlocked
                ]}>
                  {getPermissionStatusText()}
                </Text>
              </View>
            </View>
            {getPermissionIcon()}
          </TouchableOpacity>

          {permissionStatus === 'blocked' && (
            <TouchableOpacity style={styles.settingsButton} onPress={openSettings}>
              <Ionicons name="settings" size={18} color="#fff" />
              <Text style={styles.settingsButtonText}>Sozlamalarga o'tish</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shartlar va qoidalar</Text>
          <View style={styles.termsBox}>
            <Text style={styles.termsText}>
              Ushbu ilovada foydalanuvchilar turli pul mukofotlarini yutishlari mumkin.
              {"\n\n"}
              Ilovaning asosiy maqsadi - salomatlikni yaxshilash.
              {"\n\n"}
              Pul mukofotlari ixtiyoriy va faqat xarita va reytingda birinchi o'rinni egallagan foydalanuvchilar uchun mavjud.
              {"\n\n"}
              Bonus mukofotlari 100,000 dan 500,000 UZS gacha.
              {"\n\n"}
              Ilova foydalanuvchining telefon raqamini boshqa foydalanuvchilar bilan baham ko'radi.
              {"\n\n"}
              Boshqa foydalanuvchilar xaritada ism va telefon raqamini ko'rishlari mumkin.
              {"\n\n"}
              Bu foydalanuvchilar o'z hududlarini boshqalarga sotishlari mumkinligi sababli talab qilinadi.
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
              Men shartlar va qoidalarni o'qidim va qabul qilaman
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            (permissionStatus !== 'granted' || !isChecked) && styles.continueButtonDisabled,
            permissionStatus === 'blocked' && styles.continueButtonSettings,
          ]}
          onPress={permissionStatus === 'blocked' ? openSettings : handleContinue}
          disabled={isButtonDisabled()}
          activeOpacity={0.7}
        >
          <Text style={styles.continueButtonText}>{getButtonText()}</Text>
          <Ionicons 
            name={permissionStatus === 'blocked' ? 'settings' : 'arrow-forward'} 
            size={20} 
            color="#fff" 
          />
        </TouchableOpacity>

        {permissionStatus !== 'granted' && (
          <Text style={styles.warningText}>
            <Ionicons name="warning" size={14} color="#f59e0b" /> GPS ruxsatisiz ilova ishlamaydi
          </Text>
        )}
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 15,
    textAlign: 'center',
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
    borderWidth: 2,
    borderColor: '#2d3a5c',
  },
  permissionButtonGranted: {
    borderColor: '#4ade80',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  permissionButtonBlocked: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
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
  permissionDescBlocked: {
    color: '#ef4444',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  settingsButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  termsBox: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2d3a5c',
    maxHeight: 200,
  },
  termsText: {
    fontSize: 13,
    color: '#ccd6f6',
    lineHeight: 20,
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
  },
  continueButtonSettings: {
    backgroundColor: '#ef4444',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  warningText: {
    color: '#f59e0b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
});
