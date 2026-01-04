import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { API_ENDPOINTS } from '@/src/constants/api';

interface Coordinate {
  lat: number;
  lng: number;
}

export default function RunScreen() {
  const { user, updateUser } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [distance, setDistance] = useState(0);
  const [coordinates, setCoordinates] = useState<Coordinate[]>([]);
  const [saving, setSaving] = useState(false);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocation = useRef<Coordinate | null>(null);

  useEffect(() => {
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const calculateDistance = (coord1: Coordinate, coord2: Coordinate): number => {
    const R = 6371e3; // Earth's radius in meters
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

  const startRun = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is needed to track your run.');
        return;
      }

      // Get initial location
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
        (newLocation) => {
          const newCoord: Coordinate = {
            lat: newLocation.coords.latitude,
            lng: newLocation.coords.longitude,
          };

          if (lastLocation.current) {
            const dist = calculateDistance(lastLocation.current, newCoord);
            if (dist > 3) { // Only add if moved more than 3 meters
              setCoordinates((prev) => [...prev, newCoord]);
              setDistance((prev) => prev + dist);
              lastLocation.current = newCoord;
            }
          }
        }
      );
    } catch (error) {
      console.error('Error starting run:', error);
      Alert.alert('Error', 'Failed to start run tracking.');
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
    
    // Resume timer
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    // Resume location tracking
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (newLocation) => {
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
      Alert.alert('Run Too Short', 'Please run at least 10 meters to save your run.');
      resetRun();
      return;
    }

    Alert.alert(
      'Save Run',
      `You ran ${(distance / 1000).toFixed(2)} km in ${formatTime(duration)}. Save this run?`,
      [
        { text: 'Discard', style: 'destructive', onPress: resetRun },
        { text: 'Save', onPress: saveRun },
      ]
    );
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
        throw new Error(data.detail || 'Failed to save run');
      }

      // Update user's total distance locally
      const updatedUser = {
        ...user,
        total_distance: user.total_distance + distance,
      };
      await updateUser(updatedUser);

      Alert.alert('Run Saved!', `Great job! You ran ${(distance / 1000).toFixed(2)} km`);
      resetRun();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save run');
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.screenTitle}>Start Run</Text>

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
              <Text style={styles.statLabel}>Duration</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Ionicons name="speedometer" size={24} color="#4a90d9" />
              <Text style={styles.statValue}>{formatPace()}</Text>
              <Text style={styles.statLabel}>min/km</Text>
            </View>
          </View>
        </View>

        {isRunning && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>GPS Tracking Active</Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          {!isRunning ? (
            <TouchableOpacity style={styles.startButton} onPress={startRun}>
              <Ionicons name="play" size={50} color="#fff" />
              <Text style={styles.startButtonText}>START RUN</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.runningButtons}>
              {isPaused ? (
                <TouchableOpacity
                  style={[styles.controlButton, styles.resumeButton]}
                  onPress={resumeRun}
                >
                  <Ionicons name="play" size={30} color="#fff" />
                  <Text style={styles.controlButtonText}>Resume</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.controlButton, styles.pauseButton]}
                  onPress={pauseRun}
                >
                  <Ionicons name="pause" size={30} color="#fff" />
                  <Text style={styles.controlButtonText}>Pause</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.controlButton, styles.stopButton]}
                onPress={stopRun}
                disabled={saving}
              >
                <Ionicons name="stop" size={30} color="#fff" />
                <Text style={styles.controlButtonText}>
                  {saving ? 'Saving...' : 'Stop'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {!isRunning && (
          <Text style={styles.hint}>
            Press START to begin tracking your run
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
    fontSize: 24,
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
