import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { API_ENDPOINTS } from '@/src/constants/api';

interface Run {
  id: string;
  user_id: string;
  user_name: string;
  user_phone: string;
  user_avatar?: string;
  coordinates: Array<{ lat: number; lng: number }>;
  distance: number;
  duration: number;
  created_at: string;
}

export default function TerritoriesScreen() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchRuns();
    }, [user?.id])
  );

  const fetchRuns = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(API_ENDPOINTS.getUserRuns(user.id));
      if (response.ok) {
        const data = await response.json();
        setRuns(data);
      }
    } catch (error) {
      console.error('Error fetching runs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRuns();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  const getTotalDistance = () => {
    return runs.reduce((sum, run) => sum + run.distance, 0);
  };

  const renderRun = ({ item }: { item: Run }) => (
    <View style={styles.runCard}>
      <View style={styles.runHeader}>
        {item.user_avatar ? (
          <Image source={{ uri: item.user_avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={20} color="#5a6a8a" />
          </View>
        )}
        <View style={styles.runInfo}>
          <Text style={styles.runName}>{item.user_name}</Text>
          <Text style={styles.runDate}>{formatDate(item.created_at)}</Text>
        </View>
      </View>
      
      <View style={styles.runStats}>
        <View style={styles.runStat}>
          <Ionicons name="map" size={18} color="#4a90d9" />
          <Text style={styles.runStatValue}>
            {(item.distance / 1000).toFixed(2)} km
          </Text>
        </View>
        <View style={styles.runStat}>
          <Ionicons name="time" size={18} color="#4a90d9" />
          <Text style={styles.runStatValue}>
            {formatDuration(item.duration)}
          </Text>
        </View>
        <View style={styles.runStat}>
          <Ionicons name="location" size={18} color="#4a90d9" />
          <Text style={styles.runStatValue}>
            {item.coordinates.length} pts
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90d9" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenTitle}>My Territories</Text>

      <View style={styles.totalCard}>
        <View style={styles.totalRow}>
          <View style={styles.totalItem}>
            <Ionicons name="footsteps" size={28} color="#4ade80" />
            <Text style={styles.totalValue}>
              {(getTotalDistance() / 1000).toFixed(2)}
            </Text>
            <Text style={styles.totalLabel}>Total km</Text>
          </View>
          
          <View style={styles.totalDivider} />
          
          <View style={styles.totalItem}>
            <Ionicons name="flag" size={28} color="#f59e0b" />
            <Text style={styles.totalValue}>{runs.length}</Text>
            <Text style={styles.totalLabel}>Runs</Text>
          </View>
          
          <View style={styles.totalDivider} />
          
          <View style={styles.totalItem}>
            <Ionicons name="resize" size={28} color="#4a90d9" />
            <Text style={styles.totalValue}>
              {(getTotalDistance()).toFixed(0)}
            </Text>
            <Text style={styles.totalLabel}>Meters</Text>
          </View>
        </View>
      </View>

      {runs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="map-outline" size={80} color="#2d3a5c" />
          <Text style={styles.emptyTitle}>No Territories Yet</Text>
          <Text style={styles.emptyText}>
            Start running to claim your territories!
          </Text>
        </View>
      ) : (
        <FlatList
          data={runs}
          renderItem={renderRun}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4a90d9"
              colors={['#4a90d9']}
            />
          }
        />
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
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    paddingVertical: 15,
  },
  totalCard: {
    backgroundColor: '#16213e',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2d3a5c',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  totalItem: {
    alignItems: 'center',
    flex: 1,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 12,
    color: '#8892b0',
    marginTop: 4,
  },
  totalDivider: {
    width: 1,
    height: 60,
    backgroundColor: '#2d3a5c',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  runCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d3a5c',
  },
  runHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#4a90d9',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2d3a5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  runInfo: {
    marginLeft: 12,
    flex: 1,
  },
  runName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  runDate: {
    fontSize: 12,
    color: '#8892b0',
    marginTop: 2,
  },
  runStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  runStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  runStatValue: {
    fontSize: 14,
    color: '#ccd6f6',
    marginLeft: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#8892b0',
    textAlign: 'center',
    marginTop: 10,
  },
});
