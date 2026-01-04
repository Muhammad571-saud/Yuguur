import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { API_ENDPOINTS } from '../../src/constants/api';

interface Run {
  id: string;
  user_id: string;
  user_name: string;
  user_phone: string;
  coordinates: Array<{ lat: number; lng: number }>;
  distance: number;
}

export default function MapScreen() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchRuns();
      getCurrentLocation();
    }, [])
  );

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCurrentLocation({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
      // Default to Tashkent, Uzbekistan
      setCurrentLocation({ lat: 41.2995, lng: 69.2401 });
    }
  };

  const fetchRuns = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.getAllRuns);
      if (response.ok) {
        const data = await response.json();
        setRuns(data);
      }
    } catch (error) {
      console.error('Error fetching runs:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMapHTML = () => {
    const center = currentLocation || { lat: 41.2995, lng: 69.2401 };
    
    // Generate colors for different users
    const userColors: { [key: string]: string } = {};
    const colors = [
      '#4a90d9', '#4ade80', '#f59e0b', '#ef4444', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
    ];
    
    runs.forEach((run, index) => {
      if (!userColors[run.user_id]) {
        userColors[run.user_id] = colors[Object.keys(userColors).length % colors.length];
      }
    });

    const polylines = runs.map((run) => {
      const coords = run.coordinates.map(c => `[${c.lat}, ${c.lng}]`).join(',');
      const color = userColors[run.user_id];
      return `
        L.polyline([${coords}], {
          color: '${color}',
          weight: 4,
          opacity: 0.8
        }).addTo(map).bindPopup('<b>${run.user_name}</b><br>${run.user_phone}<br>${(run.distance / 1000).toFixed(2)} km');
      `;
    }).join('');

    // Add markers for starting points
    const markers = runs.map((run) => {
      if (run.coordinates.length > 0) {
        const start = run.coordinates[0];
        const color = userColors[run.user_id];
        return `
          L.circleMarker([${start.lat}, ${start.lng}], {
            radius: 8,
            fillColor: '${color}',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          }).addTo(map).bindPopup('<b>${run.user_name}</b><br>${run.user_phone}');
        `;
      }
      return '';
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 100%; height: 100%; }
          #map { width: 100%; height: 100%; background: #1a1a2e; }
          .leaflet-popup-content-wrapper {
            background: #16213e;
            color: #fff;
            border-radius: 10px;
          }
          .leaflet-popup-tip { background: #16213e; }
          .leaflet-popup-content { color: #ccd6f6; }
          .leaflet-popup-content b { color: #4a90d9; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map').setView([${center.lat}, ${center.lng}], 13);
          
          L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
            maxZoom: 19
          }).addTo(map);
          
          // Current location marker
          L.circleMarker([${center.lat}, ${center.lng}], {
            radius: 10,
            fillColor: '#4a90d9',
            color: '#fff',
            weight: 3,
            opacity: 1,
            fillOpacity: 1
          }).addTo(map).bindPopup('You are here');
          
          ${polylines}
          ${markers}
        </script>
      </body>
      </html>
    `;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90d9" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Ionicons name="map" size={24} color="#4a90d9" />
        <Text style={styles.title}>Territory Map</Text>
        <Text style={styles.runCount}>{runs.length} routes</Text>
      </View>
      
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <View style={styles.webFallback}>
            <Ionicons name="map" size={60} color="#4a90d9" />
            <Text style={styles.webFallbackText}>
              Map view is best experienced on mobile devices
            </Text>
            <Text style={styles.webFallbackSubtext}>
              {runs.length} running routes recorded
            </Text>
          </View>
        ) : (
          <WebView
            source={{ html: generateMapHTML() }}
            style={styles.map}
            scrollEnabled={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.mapLoading}>
                <ActivityIndicator size="large" color="#4a90d9" />
              </View>
            )}
          />
        )}
      </View>

      {runs.length === 0 && (
        <View style={styles.emptyOverlay}>
          <View style={styles.emptyCard}>
            <Ionicons name="footsteps" size={40} color="#4a90d9" />
            <Text style={styles.emptyText}>No routes yet</Text>
            <Text style={styles.emptySubtext}>
              Start running to see territories on the map!
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8892b0',
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#2d3a5c',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
    flex: 1,
  },
  runCount: {
    fontSize: 14,
    color: '#4a90d9',
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  mapLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  webFallbackText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
  },
  webFallbackSubtext: {
    fontSize: 14,
    color: '#8892b0',
    marginTop: 10,
  },
  emptyOverlay: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
  },
  emptyCard: {
    backgroundColor: 'rgba(22, 33, 62, 0.95)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3a5c',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8892b0',
    textAlign: 'center',
    marginTop: 6,
  },
});
