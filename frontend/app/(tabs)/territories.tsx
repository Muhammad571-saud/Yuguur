import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { API_ENDPOINTS } from '@/src/constants/api';

interface Territory {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_phone: string;
  owner_avatar?: string;
  owner_color: string;
  polygon: Array<{ lat: number; lng: number }>;
  area: number;
  created_at: string;
  updated_at: string;
}

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
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'territories' | 'runs'>('territories');

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [user?.id])
  );

  const fetchData = async () => {
    if (!user) return;
    
    try {
      const [territoriesRes, runsRes] = await Promise.all([
        fetch(API_ENDPOINTS.getUserTerritories(user.id)),
        fetch(API_ENDPOINTS.getUserRuns(user.id)),
      ]);
      
      if (territoriesRes.ok) {
        const territoriesData = await territoriesRes.json();
        setTerritories(territoriesData);
      }
      
      if (runsRes.ok) {
        const runsData = await runsRes.json();
        setRuns(runsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('uz-UZ', {
      day: 'numeric',
      month: 'short',
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
      return `${hrs}s ${mins}d`;
    }
    return `${mins}d ${secs}s`;
  };

  const getTotalDistance = () => {
    return runs.reduce((sum, run) => sum + run.distance, 0);
  };

  const getTotalArea = () => {
    return territories.reduce((sum, t) => sum + t.area, 0);
  };

  const renderTerritory = ({ item }: { item: Territory }) => (
    <View style={styles.card}>
      <View style={[styles.colorBadge, { backgroundColor: item.owner_color }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Ionicons name="flag" size={20} color={item.owner_color} />
          <Text style={styles.cardTitle}>Hudud</Text>
          <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
        </View>
        
        <View style={styles.cardStats}>
          <View style={styles.cardStat}>
            <Ionicons name="resize" size={16} color="#4a90d9" />
            <Text style={styles.cardStatValue}>
              {(item.area / 1000000).toFixed(4)} km²
            </Text>
          </View>
          <View style={styles.cardStat}>
            <Ionicons name="location" size={16} color="#4a90d9" />
            <Text style={styles.cardStatValue}>
              {item.polygon.length} nuqta
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderRun = ({ item }: { item: Run }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          {item.user_avatar ? (
            <Image source={{ uri: item.user_avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={16} color="#5a6a8a" />
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{item.user_name}</Text>
            <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
        
        <View style={styles.cardStats}>
          <View style={styles.cardStat}>
            <Ionicons name="map" size={16} color="#4a90d9" />
            <Text style={styles.cardStatValue}>
              {(item.distance / 1000).toFixed(2)} km
            </Text>
          </View>
          <View style={styles.cardStat}>
            <Ionicons name="time" size={16} color="#4a90d9" />
            <Text style={styles.cardStatValue}>
              {formatDuration(item.duration)}
            </Text>
          </View>
          <View style={styles.cardStat}>
            <Ionicons name="location" size={16} color="#4a90d9" />
            <Text style={styles.cardStatValue}>
              {item.coordinates.length} nuqta
            </Text>
          </View>
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
      <Text style={styles.screenTitle}>Mening hududlarim</Text>

      <View style={styles.totalCard}>
        <View style={styles.totalRow}>
          <View style={styles.totalItem}>
            <Ionicons name="flag" size={28} color="#f59e0b" />
            <Text style={styles.totalValue}>{territories.length}</Text>
            <Text style={styles.totalLabel}>Hududlar</Text>
          </View>
          
          <View style={styles.totalDivider} />
          
          <View style={styles.totalItem}>
            <Ionicons name="resize" size={28} color="#4ade80" />
            <Text style={styles.totalValue}>
              {(getTotalArea() / 1000000).toFixed(3)}
            </Text>
            <Text style={styles.totalLabel}>km² maydoni</Text>
          </View>
          
          <View style={styles.totalDivider} />
          
          <View style={styles.totalItem}>
            <Ionicons name="footsteps" size={28} color="#4a90d9" />
            <Text style={styles.totalValue}>
              {(getTotalDistance() / 1000).toFixed(1)}
            </Text>
            <Text style={styles.totalLabel}>km yugurdi</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'territories' && styles.tabButtonActive]}
          onPress={() => setActiveTab('territories')}
        >
          <Ionicons
            name="flag"
            size={18}
            color={activeTab === 'territories' ? '#fff' : '#8892b0'}
          />
          <Text style={[styles.tabText, activeTab === 'territories' && styles.tabTextActive]}>
            Hududlar ({territories.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'runs' && styles.tabButtonActive]}
          onPress={() => setActiveTab('runs')}
        >
          <Ionicons
            name="walk"
            size={18}
            color={activeTab === 'runs' ? '#fff' : '#8892b0'}
          />
          <Text style={[styles.tabText, activeTab === 'runs' && styles.tabTextActive]}>
            Yugurishlar ({runs.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'territories' ? (
        territories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="flag-outline" size={80} color="#2d3a5c" />
            <Text style={styles.emptyTitle}>Hududlar yo'q</Text>
            <Text style={styles.emptyText}>
              Yuguring va hududlarni egallang!
            </Text>
          </View>
        ) : (
          <FlatList
            data={territories}
            renderItem={renderTerritory}
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
        )
      ) : (
        runs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="walk-outline" size={80} color="#2d3a5c" />
            <Text style={styles.emptyTitle}>Yugurishlar yo'q</Text>
            <Text style={styles.emptyText}>
              Yugurish boshlang!
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
        )
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
    marginBottom: 15,
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 11,
    color: '#8892b0',
    marginTop: 4,
    textAlign: 'center',
  },
  totalDivider: {
    width: 1,
    height: 60,
    backgroundColor: '#2d3a5c',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 15,
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#4a90d9',
  },
  tabText: {
    fontSize: 14,
    color: '#8892b0',
    marginLeft: 6,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d3a5c',
    overflow: 'hidden',
  },
  colorBadge: {
    height: 4,
    width: '100%',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#4a90d9',
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2d3a5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    marginLeft: 12,
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
    flex: 1,
  },
  cardDate: {
    fontSize: 12,
    color: '#8892b0',
  },
  cardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardStatValue: {
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
