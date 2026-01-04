import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Vibration,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function RunScreen() {
  const { user, updateUser } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [distance, setDistance] = useState(0);
  const [coordinates, setCoordinates] = useState<Coordinate[]>([]);
  const [saving, setSaving] = useState(false);
  const [invasionCount, setInvasionCount] = useState(0);
  const [mapKey, setMapKey] = useState(0);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocation = useRef<Coordinate | null>(null);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    registerForPushNotifications();
    
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Update map when coordinates change
  useEffect(() => {
    if (coordinates.length > 0 && webViewRef.current) {
      const lastCoord = coordinates[coordinates.length - 1];
      const script = `
        if (typeof updateRoute !== 'undefined') {
          updateRoute(${JSON.stringify(coordinates)}, ${lastCoord.lat}, ${lastCoord.lng});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(script);
    }
  }, [coordinates]);

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
        return;
      }
      
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      
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
      content: { title, body, sound: true },
      trigger: null,
    });
  };

  const calculateDistance = (coord1: Coordinate, coord2: Coordinate): number => {
    const R = 6371e3;
    const φ1 = (coord1.lat * Math.PI) / 180;
    const φ2 = (coord2.lat * Math.PI) / 180;
    const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
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
        body: JSON.stringify({ lat: coord.lat, lng: coord.lng, user_id: user.id }),
      });
      
      if (response.ok) {
        const result: InvasionResult = await response.json();
        
        if (result.invaded) {
          setInvasionCount(prev => prev + 1);
          
          if (Platform.OS !== 'web') {
            Vibration.vibrate([0, 500, 200, 500]);
          }
          
          await sendLocalNotification(
            '🏆 Hudud egallandi!',
            `Siz ${result.old_owner_name} ning hududini egalladingiz!`
          );
          
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
      setMapKey(prev => prev + 1);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 3,
        },
        async (newLocation) => {
          const newCoord: Coordinate = {
            lat: newLocation.coords.latitude,
            lng: newLocation.coords.longitude,
          };

          if (lastLocation.current) {
            const dist = calculateDistance(lastLocation.current, newCoord);
            if (dist > 2) {
              setCoordinates((prev) => [...prev, newCoord]);
              setDistance((prev) => prev + dist);
              lastLocation.current = newCoord;
              
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
        timeInterval: 1000,
        distanceInterval: 3,
      },
      async (newLocation) => {
        const newCoord: Coordinate = {
          lat: newLocation.coords.latitude,
          lng: newLocation.coords.longitude,
        };

        if (lastLocation.current) {
          const dist = calculateDistance(lastLocation.current, newCoord);
          if (dist > 2) {
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

  const saveRunWithTerritory = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
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

      if (coordinates.length >= 3) {
        const territoryResponse = await fetch(API_ENDPOINTS.createTerritory, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': user.id,
          },
          body: JSON.stringify({
            polygon: coordinates,
            run_id: runData.id,
          }),
        });

        if (territoryResponse.ok) {
          const territoryData = await territoryResponse.json();
          Alert.alert(
            'Hudud yaratildi!',
            `Ajoyib! Siz ${(distance / 1000).toFixed(2)} km yugurdingiz\nTezlik: ${calculateSpeed()} km/soat\nHudud maydoni: ${(territoryData.area / 1000000).toFixed(4)} km²`
          );
        } else {
          Alert.alert('Saqlandi!', `${(distance / 1000).toFixed(2)} km yugurish saqlandi`);
        }
      } else {
        Alert.alert('Saqlandi!', `${(distance / 1000).toFixed(2)} km yugurish saqlandi`);
      }

      const updatedUser = {
        ...user,
        total_distance: user.total_distance + distance,
      };
      await updateUser(updatedUser);

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

  const calculateSpeed = (): string => {
    if (duration < 10 || distance < 10) return '0.0';
    const hours = duration / 3600;
    const km = distance / 1000;
    const speed = km / hours;
    return speed.toFixed(1);
  };

  const generateMapHTML = () => {
    const center = coordinates.length > 0 
      ? coordinates[coordinates.length - 1] 
      : { lat: 41.2995, lng: 69.2401 };
    
    const coordsJSON = JSON.stringify(coordinates);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { margin: 0; padding: 0; }
          html, body, #map { width: 100%; height: 100%; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([${center.lat}, ${center.lng}], 17);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
          }).addTo(map);
          
          var routeLine = null;
          var currentMarker = null;
          var startMarker = null;
          
          var coords = ${coordsJSON};
          
          if (coords.length > 0) {
            // Start marker (green)
            startMarker = L.circleMarker([coords[0].lat, coords[0].lng], {
              radius: 10,
              fillColor: '#22c55e',
              color: '#fff',
              weight: 3,
              fillOpacity: 1
            }).addTo(map);
            
            // Route line (blue)
            var latLngs = coords.map(c => [c.lat, c.lng]);
            routeLine = L.polyline(latLngs, {
              color: '#4a90d9',
              weight: 5,
              opacity: 0.9
            }).addTo(map);
            
            // Current position marker (red pulse)
            var last = coords[coords.length - 1];
            currentMarker = L.circleMarker([last.lat, last.lng], {
              radius: 12,
              fillColor: '#ef4444',
              color: '#fff',
              weight: 3,
              fillOpacity: 1
            }).addTo(map);
            
            map.setView([last.lat, last.lng], 17);
          }
          
          // Function to update route from React Native
          function updateRoute(newCoords, lat, lng) {
            if (!startMarker && newCoords.length > 0) {
              startMarker = L.circleMarker([newCoords[0].lat, newCoords[0].lng], {
                radius: 10,
                fillColor: '#22c55e',
                color: '#fff',
                weight: 3,
                fillOpacity: 1
              }).addTo(map);
            }
            
            var latLngs = newCoords.map(c => [c.lat, c.lng]);
            
            if (routeLine) {
              routeLine.setLatLngs(latLngs);
            } else {
              routeLine = L.polyline(latLngs, {
                color: '#4a90d9',
                weight: 5,
                opacity: 0.9
              }).addTo(map);
            }
            
            if (currentMarker) {
              currentMarker.setLatLng([lat, lng]);
            } else {
              currentMarker = L.circleMarker([lat, lng], {
                radius: 12,
                fillColor: '#ef4444',
                color: '#fff',
                weight: 3,
                fillOpacity: 1
              }).addTo(map);
            }
            
            map.setView([lat, lng], 17);
          }
        </script>
      </body>
      </html>
    `;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.screenTitle}>Yugurish</Text>

        {/* Mini Map - shows during running */}
        {(isRunning || coordinates.length > 0) && Platform.OS !== 'web' && (
          <View style={styles.mapContainer}>
            <WebView
              ref={webViewRef}
              key={mapKey}
              source={{ html: generateMapHTML() }}
              style={styles.miniMap}
              scrollEnabled={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
            <View style={styles.mapOverlay}>
              <View style={styles.mapLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
                  <Text style={styles.legendText}>Boshlash</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                  <Text style={styles.legendText}>Hozirgi joy</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Web fallback for map */}
        {(isRunning || coordinates.length > 0) && Platform.OS === 'web' && (
          <View style={styles.webMapFallback}>
            <Ionicons name="map" size={30} color="#4a90d9" />
            <Text style={styles.webMapText}>{coordinates.length} nuqta yozildi</Text>
          </View>
        )}

        <View style={styles.statsContainer}>
          <View style={styles.mainStat}>
            <Text style={styles.mainStatValue}>
              {(distance / 1000).toFixed(2)}
            </Text>
            <Text style={styles.mainStatUnit}>km</Text>
          </View>

          <View style={styles.secondaryStats}>
            <View style={styles.statItem}>
              <Ionicons name="time" size={22} color="#4a90d9" />
              <Text style={styles.statValue}>{formatTime(duration)}</Text>
              <Text style={styles.statLabel}>Vaqt</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Ionicons name="speedometer" size={22} color="#4ade80" />
              <Text style={styles.statValue}>{calculateSpeed()}</Text>
              <Text style={styles.statLabel}>km/soat</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Ionicons name="flag" size={22} color="#f59e0b" />
              <Text style={styles.statValue}>{invasionCount}</Text>
              <Text style={styles.statLabel}>Egallandi</Text>
            </View>
          </View>
        </View>

        {isRunning && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>GPS kuzatuv faol • {coordinates.length} nuqta</Text>
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
                  <Ionicons name="play" size={28} color="#fff" />
                  <Text style={styles.controlButtonText}>Davom</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.controlButton, styles.pauseButton]}
                  onPress={pauseRun}
                >
                  <Ionicons name="pause" size={28} color="#fff" />
                  <Text style={styles.controlButtonText}>Pauza</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.controlButton, styles.stopButton]}
                onPress={stopRun}
                disabled={saving}
              >
                <Ionicons name="stop" size={28} color="#fff" />
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
    padding: 15,
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  mapContainer: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#4a90d9',
  },
  miniMap: {
    flex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
  },
  mapLegend: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    padding: 6,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  legendText: {
    color: '#fff',
    fontSize: 11,
  },
  webMapFallback: {
    width: '100%',
    height: 100,
    backgroundColor: '#16213e',
    borderRadius: 16,
    marginBottom: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2d3a5c',
  },
  webMapText: {
    color: '#8892b0',
    marginTop: 8,
    fontSize: 14,
  },
  statsContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  mainStat: {
    alignItems: 'center',
    marginBottom: 15,
  },
  mainStatValue: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  mainStatUnit: {
    fontSize: 20,
    color: '#8892b0',
    marginTop: -5,
  },
  secondaryStats: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    borderRadius: 14,
    padding: 15,
    width: '100%',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#2d3a5c',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 11,
    color: '#8892b0',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2d3a5c',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 15,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
    marginRight: 6,
  },
  liveText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '500',
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  startButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 6,
  },
  runningButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  controlButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginTop: 4,
  },
  hint: {
    fontSize: 13,
    color: '#5a6a8a',
    textAlign: 'center',
    marginBottom: 10,
  },
});
