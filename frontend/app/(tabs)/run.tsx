import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { API_ENDPOINTS } from '@/src/constants/api';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface Coordinate {
  lat: number;
  lng: number;
}

interface InvasionResult {
  invaded: boolean;
  territory_id?: string;
  old_owner_id?: string;
  old_owner_name?: string;
  old_owner_push_token?: string;
  new_owner_name?: string;
}

export default function RunScreen() {
  const { user, updateUser } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [distance, setDistance] = useState(0);
  const [coordinates, setCoordinates] = useState<Coordinate[]>([]);
  const [saving, setSaving] = useState(false);
  const [invasionCount, setInvasionCount] = useState(0);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocation = useRef<Coordinate | null>(null);
  const invasionCheckInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    registerForPushNotifications();
    
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (invasionCheckInterval.current) {
        clearInterval(invasionCheckInterval.current);
      }
    };
  }, []);

  const registerForPushNotifications = async () => {
    if (Platform.OS === 'web') return;
    
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Push notification permission not granted');
        return;
      }
      
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      
      // Save push token to user profile
      if (user && token) {
        await fetch(API_ENDPOINTS.updateUser(user.id), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ push_token: token }),
        });
      }
    } catch (error) {
      console.error('Error registering for push notifications:', error);
    }
  };

  const sendLocalNotification = async (title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // Immediate
    });
  };

  const calculateDistance = (coord1: Coordinate, coord2: Coordinate): number => {
    const R = 6371e3;
    const φ1 = (coord1.lat * Math.PI) / 180;
    const φ2 = (coord2.lat * Math.PI) / 180;
    const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const checkForInvasion = async (coord: Coordinate) => {
    if (!user) return;
    
    try {
      const response = await fetch(API_ENDPOINTS.checkInvasion, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: coord.lat,
          lng: coord.lng,
          user_id: user.id,
        }),
      });
      
      if (response.ok) {
        const result: InvasionResult = await response.json();
        
        if (result.invaded) {
          setInvasionCount(prev => prev + 1);
          
          // Vibrate to notify
          if (Platform.OS !== 'web') {
            Vibration.vibrate([0, 500, 200, 500]);
          }
          
          // Show local notification for invader
          await sendLocalNotification(
            '🏆 Hudud egallandi!',
            `Siz ${result.old_owner_name} ning hududini egalladingiz!`
          );
          
          // Alert for immediate feedback
          Alert.alert(
            '🏆 Hudud egallandi!',
            `Siz ${result.old_owner_name} ning hududini egalladingiz!`,
            [{ text: 'Ajoyib!' }]
          );
        }
      }
    } catch (error) {
      console.error('Error checking invasion:', error);
    }
  };

  const startRun = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Ruxsat kerak', 'Yugurish kuzatuvi uchun joylashuv ruxsati kerak.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const initialCoord: Coordinate = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      
      setCoordinates([initialCoord]);
      lastLocation.current = initialCoord;
      setIsRunning(true);
      setIsPaused(false);
      setDuration(0);
      setDistance(0);
      setInvasionCount(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Start location tracking
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 5,
        },
        async (newLocation) => {
          const newCoord: Coordinate = {
            lat: newLocation.coords.latitude,
            lng: newLocation.coords.longitude,
          };

          if (lastLocation.current) {
            const dist = calculateDistance(lastLocation.current, newCoord);
            if (dist > 3) {
              setCoordinates((prev) => [...prev, newCoord]);
              setDistance((prev) => prev + dist);
              lastLocation.current = newCoord;
              
              // Check for invasion on each significant move
              await checkForInvasion(newCoord);
            }
          }
        }
      );
    } catch (error) {
      console.error('Error starting run:', error);
      Alert.alert('Xato', 'Yugurish kuzatuvini boshlashda xatolik.');
    }
  };

  const pauseRun = () => {
    setIsPaused(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  };

  const resumeRun = async () => {
    setIsPaused(false);
    
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      async (newLocation) => {
        const newCoord: Coordinate = {
          lat: newLocation.coords.latitude,
          lng: newLocation.coords.longitude,
        };

        if (lastLocation.current) {
          const dist = calculateDistance(lastLocation.current, newCoord);
          if (dist > 3) {
            setCoordinates((prev) => [...prev, newCoord]);
            setDistance((prev) => prev + dist);
            lastLocation.current = newCoord;
            
            await checkForInvasion(newCoord);
          }
        }
      }
    );
  };

  const stopRun = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }

    if (coordinates.length < 2 || distance < 10) {
      Alert.alert('Yugurish juda qisqa', 'Saqlash uchun kamida 10 metr yuguring.');
      resetRun();
      return;
    }

    // Calculate territory area
    const areaM2 = calculatePolygonArea(coordinates);
    const areaKm2 = (areaM2 / 1000000).toFixed(4);

    Alert.alert(
      'Yugurish saqlash',
      `Siz ${(distance / 1000).toFixed(2)} km yugurdingiz\nTezlik: ${calculateSpeed()} km/soat\nHudud: ${areaKm2} km²\n${invasionCount > 0 ? `${invasionCount} ta hudud egallandi!` : ''}\n\nSaqlash va hudud yaratilsinmi?`,
      [
        { text: 'Bekor qilish', style: 'destructive', onPress: resetRun },
        { text: 'Saqlash', onPress: saveRunWithTerritory },
      ]
    );
  };

  // Calculate polygon area
  const calculatePolygonArea = (coords: Coordinate[]): number => {
    if (coords.length < 3) return 0;
    
    const latToM = 111320;
    const lngToM = 111320;
    
    let area = 0;
    const n = coords.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const xi = coords[i].lng * lngToM;
      const yi = coords[i].lat * latToM;
      const xj = coords[j].lng * lngToM;
      const yj = coords[j].lat * latToM;
      area += (xi * yj) - (xj * yi);
    }
    
    return Math.abs(area / 2);
  };

  const saveRun = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const response = await fetch(API_ENDPOINTS.createRun, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id,
        },
        body: JSON.stringify({
          coordinates,
          distance: Math.round(distance),
          duration,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Saqlashda xatolik');
      }

      const updatedUser = {
        ...user,
        total_distance: user.total_distance + distance,
      };
      await updateUser(updatedUser);

      Alert.alert('Saqlandi!', `Ajoyib! Siz ${(distance / 1000).toFixed(2)} km yugurdingiz`);
      resetRun();
    } catch (error: any) {
      Alert.alert('Xato', error.message || 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const saveRunWithTerritory = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      // First save the run
      const runResponse = await fetch(API_ENDPOINTS.createRun, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id,
        },
        body: JSON.stringify({
          coordinates,
          distance: Math.round(distance),
          duration,
        }),
      });

      const runData = await runResponse.json();

      if (!runResponse.ok) {
        throw new Error(runData.detail || 'Saqlashda xatolik');
      }

      // Create territory from the run coordinates (create polygon)
      // Close the polygon by connecting end to start
      const polygon = [...coordinates];
      if (polygon.length >= 3) {
        const territoryResponse = await fetch(API_ENDPOINTS.createTerritory, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': user.id,
          },
          body: JSON.stringify({
            polygon: polygon,
            run_id: runData.id,
          }),
        });

        if (!territoryResponse.ok) {
          console.log('Territory creation failed, but run was saved');
        }
      }

      const updatedUser = {
        ...user,
        total_distance: user.total_distance + distance,
      };
      await updateUser(updatedUser);

      Alert.alert(
        'Hudud yaratildi!',
        `Ajoyib! Siz ${(distance / 1000).toFixed(2)} km yugurdingiz va hudud yaratdingiz!`
      );
      resetRun();
    } catch (error: any) {
      Alert.alert('Xato', error.message || 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const resetRun = () => {
    setIsRunning(false);
    setIsPaused(false);
    setDuration(0);
    setDistance(0);
    setCoordinates([]);
    setInvasionCount(0);
    lastLocation.current = null;
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (): string => {
    if (distance < 100) return '--:--';
    const paceSeconds = (duration / (distance / 1000));
    const mins = Math.floor(paceSeconds / 60);
    const secs = Math.floor(paceSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateSpeed = (): string => {
    if (duration < 10 || distance < 10) return '0.0';
    const hours = duration / 3600;
    const km = distance / 1000;
    const speed = km / hours;
    return speed.toFixed(1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.screenTitle}>Yugurish</Text>

        <View style={styles.statsContainer}>
          <View style={styles.mainStat}>
            <Text style={styles.mainStatValue}>
              {(distance / 1000).toFixed(2)}
            </Text>
            <Text style={styles.mainStatUnit}>km</Text>
          </View>

          <View style={styles.secondaryStats}>
            <View style={styles.statItem}>
              <Ionicons name="time" size={24} color="#4a90d9" />
              <Text style={styles.statValue}>{formatTime(duration)}</Text>
              <Text style={styles.statLabel}>Vaqt</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Ionicons name="speedometer" size={24} color="#4ade80" />
              <Text style={styles.statValue}>{calculateSpeed()}</Text>
              <Text style={styles.statLabel}>km/soat</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Ionicons name="flag" size={24} color="#f59e0b" />
              <Text style={styles.statValue}>{invasionCount}</Text>
              <Text style={styles.statLabel}>Egallandi</Text>
            </View>
          </View>
        </View>

        {isRunning && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>GPS kuzatuv faol</Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          {!isRunning ? (
            <TouchableOpacity style={styles.startButton} onPress={startRun}>
              <Ionicons name="play" size={50} color="#fff" />
              <Text style={styles.startButtonText}>BOSHLASH</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.runningButtons}>
              {isPaused ? (
                <TouchableOpacity
                  style={[styles.controlButton, styles.resumeButton]}
                  onPress={resumeRun}
                >
                  <Ionicons name="play" size={30} color="#fff" />
                  <Text style={styles.controlButtonText}>Davom</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.controlButton, styles.pauseButton]}
                  onPress={pauseRun}
                >
                  <Ionicons name="pause" size={30} color="#fff" />
                  <Text style={styles.controlButtonText}>Pauza</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.controlButton, styles.stopButton]}
                onPress={stopRun}
                disabled={saving}
              >
                <Ionicons name="stop" size={30} color="#fff" />
                <Text style={styles.controlButtonText}>
                  {saving ? 'Saqlanmoqda...' : "To'xtatish"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {!isRunning && (
          <Text style={styles.hint}>
            Yugurish kuzatuvini boshlash uchun BOSHLASH tugmasini bosing
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 30,
  },
  statsContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  mainStat: {
    alignItems: 'center',
    marginBottom: 30,
  },
  mainStatValue: {
    fontSize: 80,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  mainStatUnit: {
    fontSize: 24,
    color: '#8892b0',
    marginTop: -10,
  },
  secondaryStats: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#2d3a5c',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#8892b0',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2d3a5c',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 30,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ade80',
    marginRight: 8,
  },
  liveText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  startButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#4a90d9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4a90d9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  runningButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  controlButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 15,
  },
  pauseButton: {
    backgroundColor: '#f59e0b',
  },
  resumeButton: {
    backgroundColor: '#4ade80',
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  controlButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 5,
  },
  hint: {
    fontSize: 14,
    color: '#5a6a8a',
    textAlign: 'center',
    marginBottom: 20,
  },
});
