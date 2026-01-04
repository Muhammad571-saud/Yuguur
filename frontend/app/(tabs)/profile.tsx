import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAuth } from '../../src/context/AuthContext';
import { API_ENDPOINTS } from '../../src/constants/api';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateUser, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (user) {
        refreshUserData();
      }
    }, [user?.id])
  );

  const refreshUserData = async () => {
    if (!user) return;
    try {
      const response = await fetch(API_ENDPOINTS.getUser(user.id));
      if (response.ok) {
        const data = await response.json();
        await updateUser(data);
        setNewName(data.name);
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64 && user) {
      setLoading(true);
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      
      try {
        const response = await fetch(API_ENDPOINTS.updateUser(user.id), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: base64Image }),
        });

        const data = await response.json();
        if (response.ok) {
          await updateUser(data);
          Alert.alert('Success', 'Avatar updated successfully!');
        } else {
          throw new Error(data.detail || 'Failed to update avatar');
        }
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to update avatar');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim() || !user) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.updateUser(user.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });

      const data = await response.json();
      if (response.ok) {
        await updateUser(data);
        setEditingName(false);
        Alert.alert('Success', 'Name updated successfully!');
      } else {
        throw new Error(data.detail || 'Failed to update name');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update name');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    if (newPassword.length < 4) {
      Alert.alert('Error', 'Password must be at least 4 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.changePassword(user!.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setShowPasswordModal(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        Alert.alert('Success', 'Password changed successfully!');
      } else {
        throw new Error(data.detail || 'Failed to change password');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  if (!user) {
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
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>My Profile</Text>

        <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
          {user.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={50} color="#5a6a8a" />
            </View>
          )}
          <View style={styles.editBadge}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="person" size={20} color="#4a90d9" />
              <Text style={styles.infoLabel}>Name</Text>
            </View>
            {editingName ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.editInput}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                  maxLength={50}
                />
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveName}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setEditingName(false);
                    setNewName(user.name);
                  }}
                >
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.infoRow}>
                <Text style={styles.infoValue}>{user.name}</Text>
                <TouchableOpacity onPress={() => setEditingName(true)}>
                  <Ionicons name="pencil" size={18} color="#4a90d9" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="call" size={20} color="#4a90d9" />
              <Text style={styles.infoLabel}>Phone</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoValue}>{user.phone}</Text>
              <Ionicons name="lock-closed" size={16} color="#5a6a8a" />
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="trophy" size={20} color="#4a90d9" />
              <Text style={styles.infoLabel}>Total Distance</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.distanceValue}>
                {(user.total_distance / 1000).toFixed(2)} km
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowPasswordModal(true)}
          >
            <Ionicons name="key" size={22} color="#4a90d9" />
            <Text style={styles.actionText}>Change Password</Text>
            <Ionicons name="chevron-forward" size={20} color="#5a6a8a" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={22} color="#ef4444" />
            <Text style={[styles.actionText, styles.logoutText]}>Logout</Text>
            <Ionicons name="chevron-forward" size={20} color="#5a6a8a" />
          </TouchableOpacity>
        </View>

        {/* Password Change Modal */}
        <Modal
          visible={showPasswordModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPasswordModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Change Password</Text>

              <View style={styles.modalInput}>
                <TextInput
                  style={styles.modalInputField}
                  placeholder="Current Password"
                  placeholderTextColor="#5a6a8a"
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  secureTextEntry
                />
              </View>

              <View style={styles.modalInput}>
                <TextInput
                  style={styles.modalInputField}
                  placeholder="New Password"
                  placeholderTextColor="#5a6a8a"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
              </View>

              <View style={styles.modalInput}>
                <TextInput
                  style={styles.modalInputField}
                  placeholder="Confirm New Password"
                  placeholderTextColor="#5a6a8a"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => {
                    setShowPasswordModal(false);
                    setOldPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, loading && styles.buttonDisabled]}
                  onPress={handleChangePassword}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSaveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAwareScrollView>
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
  scrollContent: {
    padding: 20,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 25,
  },
  avatarContainer: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 30,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#4a90d9',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#16213e',
    borderWidth: 3,
    borderColor: '#2d3a5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4a90d9',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#1a1a2e',
  },
  infoSection: {
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d3a5c',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: '#8892b0',
    marginLeft: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoValue: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
  },
  distanceValue: {
    fontSize: 24,
    color: '#4ade80',
    fontWeight: 'bold',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editInput: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: '#fff',
    marginRight: 10,
  },
  saveBtn: {
    backgroundColor: '#4ade80',
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  cancelBtn: {
    backgroundColor: '#ef4444',
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsSection: {
    marginTop: 10,
  },
  actionButton: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d3a5c',
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
  },
  logoutButton: {
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  logoutText: {
    color: '#ef4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d3a5c',
  },
  modalInputField: {
    padding: 14,
    fontSize: 16,
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#2d3a5c',
    marginRight: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  modalSaveBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#4a90d9',
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
