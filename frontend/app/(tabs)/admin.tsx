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
import { API_ENDPOINTS } from '../../src/constants/api';

interface AdminUser {
  id: string;
  phone: string;
  name: string;
  avatar?: string;
  total_distance: number;
  rank: number;
  created_at: string;
}

export default function AdminScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchUsers();
      }
    }, [isAuthenticated])
  );

  const handleLogin = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter admin password');
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
        fetchUsers();
      } else {
        Alert.alert('Error', 'Invalid admin password');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.adminUsers, {
        headers: { 'X-Admin-Password': password },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
          <Text style={styles.userDate}>Joined {formatDate(item.created_at)}</Text>
        </View>
        
        <View style={styles.userStats}>
          <Text style={styles.distanceValue}>
            {(item.total_distance / 1000).toFixed(2)}
          </Text>
          <Text style={styles.distanceUnit}>km</Text>
        </View>
      </View>
    </View>
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authContainer}>
          <View style={styles.authCard}>
            <Ionicons name="shield-checkmark" size={60} color="#4a90d9" />
            <Text style={styles.authTitle}>Admin Access</Text>
            <Text style={styles.authSubtitle}>Enter admin password to continue</Text>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#8892b0" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Admin Password"
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
                  <Text style={styles.loginButtonText}>Access Admin Panel</Text>
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
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            setIsAuthenticated(false);
            setPassword('');
            setUsers([]);
          }}
        >
          <Ionicons name="log-out" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Ionicons name="people" size={20} color="#4a90d9" />
          <Text style={styles.statValue}>{users.length}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
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

      {users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#4a90d9" />
          <Text style={styles.emptyText}>Loading users...</Text>
        </View>
      ) : (
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
    marginTop: 20,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 12,
    color: '#8892b0',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2d3a5c',
    marginHorizontal: 10,
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
    fontSize: 12,
    color: '#5a6a8a',
    marginTop: 2,
  },
  userStats: {
    alignItems: 'center',
  },
  distanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4ade80',
  },
  distanceUnit: {
    fontSize: 12,
    color: '#8892b0',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#8892b0',
    marginTop: 12,
    fontSize: 16,
  },
});
