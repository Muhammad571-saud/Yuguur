import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_ENDPOINTS } from '@/src/constants/api';

interface AdminUser {
  id: string;
  phone: string;
  name: string;
  avatar?: string;
  total_distance: number;
  territory_count: number;
  rank: number;
  created_at: string;
}

interface InvasionHistory {
  id: string;
  territory_id: string;
  old_owner_id: string;
  old_owner_name: string;
  new_owner_id: string;
  new_owner_name: string;
  invasion_point: { lat: number; lng: number };
  timestamp: string;
}

export default function AdminScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invasions, setInvasions] = useState<InvasionHistory[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'invasions'>('users');

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchData();
      }
    }, [isAuthenticated])
  );

  const handleLogin = async () => {
    if (!password) {
      Alert.alert('Xato', 'Admin parolini kiriting');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.verifyAdmin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setIsAuthenticated(true);
        fetchData();
      } else {
        Alert.alert('Xato', "Noto'g'ri admin paroli");
      }
    } catch (error) {
      Alert.alert('Xato', 'Autentifikatsiya amalga oshmadi');
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const [usersRes, invasionsRes] = await Promise.all([
        fetch(API_ENDPOINTS.adminUsers, {
          headers: { 'X-Admin-Password': password },
        }),
        fetch(API_ENDPOINTS.adminInvasionHistory, {
          headers: { 'X-Admin-Password': password },
        }),
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      if (invasionsRes.ok) {
        const invasionsData = await invasionsRes.json();
        setInvasions(invasionsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
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

  const renderUser = ({ item }: { item: AdminUser }) => (
    <View style={styles.userCard}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#{item.rank}</Text>
      </View>
      
      <View style={styles.userMain}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={24} color="#5a6a8a" />
          </View>
        )}
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userPhone}>{item.phone}</Text>
          <Text style={styles.userDate}>Qo'shildi: {formatDate(item.created_at)}</Text>
        </View>
        
        <View style={styles.userStats}>
          <View style={styles.userStatItem}>
            <Text style={styles.distanceValue}>
              {(item.total_distance / 1000).toFixed(2)}
            </Text>
            <Text style={styles.distanceUnit}>km</Text>
          </View>
          <View style={styles.userStatItem}>
            <Text style={styles.territoryValue}>{item.territory_count}</Text>
            <Text style={styles.territoryUnit}>hudud</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderInvasion = ({ item }: { item: InvasionHistory }) => (
    <View style={styles.invasionCard}>
      <View style={styles.invasionHeader}>
        <Ionicons name="flag" size={20} color="#ef4444" />
        <Text style={styles.invasionTitle}>Hudud egallandi</Text>
        <Text style={styles.invasionDate}>{formatDate(item.timestamp)}</Text>
      </View>
      
      <View style={styles.invasionDetails}>
        <View style={styles.invasionParty}>
          <Text style={styles.invasionLabel}>Eski egasi:</Text>
          <Text style={styles.invasionName}>{item.old_owner_name}</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color="#4a90d9" />
        <View style={styles.invasionParty}>
          <Text style={styles.invasionLabel}>Yangi egasi:</Text>
          <Text style={[styles.invasionName, { color: '#4ade80' }]}>{item.new_owner_name}</Text>
        </View>
      </View>
      
      <View style={styles.invasionLocation}>
        <Ionicons name="location" size={14} color="#8892b0" />
        <Text style={styles.invasionCoords}>
          {item.invasion_point.lat.toFixed(6)}, {item.invasion_point.lng.toFixed(6)}
        </Text>
      </View>
    </View>
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authContainer}>
          <View style={styles.authCard}>
            <Ionicons name="shield-checkmark" size={60} color="#4a90d9" />
            <Text style={styles.authTitle}>Admin paneli</Text>
            <Text style={styles.authSubtitle}>Davom etish uchun admin parolini kiriting</Text>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#8892b0" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Admin paroli"
                placeholderTextColor="#5a6a8a"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#8892b0"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="enter" size={20} color="#fff" />
                  <Text style={styles.loginButtonText}>Kirish</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="shield" size={24} color="#4a90d9" />
        <Text style={styles.headerTitle}>Admin paneli</Text>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            setIsAuthenticated(false);
            setPassword('');
            setUsers([]);
            setInvasions([]);
          }}
        >
          <Ionicons name="log-out" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Ionicons name="people" size={20} color="#4a90d9" />
          <Text style={styles.statValue}>{users.length}</Text>
          <Text style={styles.statLabel}>Foydalanuvchilar</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="flag" size={20} color="#ef4444" />
          <Text style={styles.statValue}>{invasions.length}</Text>
          <Text style={styles.statLabel}>Egallanishlar</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="trophy" size={20} color="#f59e0b" />
          <Text style={styles.statValue}>
            {users.length > 0 ? (users[0].total_distance / 1000).toFixed(1) : 0}
          </Text>
          <Text style={styles.statLabel}>Top km</Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'users' && styles.tabButtonActive]}
          onPress={() => setActiveTab('users')}
        >
          <Ionicons
            name="people"
            size={18}
            color={activeTab === 'users' ? '#fff' : '#8892b0'}
          />
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
            Foydalanuvchilar
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'invasions' && styles.tabButtonActive]}
          onPress={() => setActiveTab('invasions')}
        >
          <Ionicons
            name="flag"
            size={18}
            color={activeTab === 'invasions' ? '#fff' : '#8892b0'}
          />
          <Text style={[styles.tabText, activeTab === 'invasions' && styles.tabTextActive]}>
            Egallanishlar
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'users' ? (
        <FlatList
          data={users}
          renderItem={renderUser}
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#4a90d9" />
              <Text style={styles.emptyText}>Yuklanmoqda...</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={invasions}
          renderItem={renderInvasion}
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="flag-outline" size={60} color="#2d3a5c" />
              <Text style={styles.emptyText}>Egallanishlar tarixi yo'q</Text>
            </View>
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
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  authCard: {
    backgroundColor: '#16213e',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d3a5c',
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  authSubtitle: {
    fontSize: 14,
    color: '#8892b0',
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2d3a5c',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 55,
    fontSize: 16,
    color: '#fff',
  },
  loginButton: {
    backgroundColor: '#4a90d9',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
    flex: 1,
  },
  logoutBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2d3a5c',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#8892b0',
    marginTop: 2,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2d3a5c',
    marginHorizontal: 10,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 15,
    marginBottom: 10,
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
    padding: 20,
  },
  userCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d3a5c',
  },
  rankBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    backgroundColor: '#4a90d9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#4a90d9',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2d3a5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  userPhone: {
    fontSize: 14,
    color: '#4a90d9',
    marginTop: 2,
  },
  userDate: {
    fontSize: 11,
    color: '#5a6a8a',
    marginTop: 2,
  },
  userStats: {
    alignItems: 'flex-end',
  },
  userStatItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  distanceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  distanceUnit: {
    fontSize: 12,
    color: '#8892b0',
    marginLeft: 4,
  },
  territoryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  territoryUnit: {
    fontSize: 11,
    color: '#8892b0',
    marginLeft: 4,
  },
  invasionCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
    borderLeftWidth: 4,
  },
  invasionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  invasionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
    marginLeft: 8,
    flex: 1,
  },
  invasionDate: {
    fontSize: 11,
    color: '#8892b0',
  },
  invasionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  invasionParty: {
    flex: 1,
  },
  invasionLabel: {
    fontSize: 11,
    color: '#8892b0',
  },
  invasionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 2,
  },
  invasionLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2d3a5c',
  },
  invasionCoords: {
    fontSize: 12,
    color: '#8892b0',
    marginLeft: 6,
    fontFamily: 'monospace',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#8892b0',
    marginTop: 12,
    fontSize: 16,
  },
});
