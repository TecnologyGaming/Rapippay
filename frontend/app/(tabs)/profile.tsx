import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Profile() {
  const { user, logout, token, updateUser } = useAuth();
  const router = useRouter();
  
  // Mis Datos modal
  const [showMisDatos, setShowMisDatos] = useState(false);
  const [editingData, setEditingData] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);

  const openMisDatos = () => {
    setEditingData({
      first_name: user?.first_name || user?.name?.split(' ')[0] || '',
      last_name: user?.last_name || user?.name?.split(' ').slice(1).join(' ') || '',
      phone_number: user?.phone_number || '',
      email: user?.email || '',
    });
    setShowMisDatos(true);
  };

  const handleSaveMisDatos = async () => {
    if (!editingData.first_name.trim() || !editingData.last_name.trim()) {
      Alert.alert('Error', 'Nombre y apellido son obligatorios');
      return;
    }

    setSaving(true);
    try {
      const response = await axios.patch(
        `${BACKEND_URL}/api/users/me`,
        {
          first_name: editingData.first_name,
          last_name: editingData.last_name,
          phone_number: editingData.phone_number,
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Update local user state
      if (updateUser) {
        updateUser({
          ...user,
          first_name: editingData.first_name,
          last_name: editingData.last_name,
          phone_number: editingData.phone_number,
          name: `${editingData.first_name} ${editingData.last_name}`,
        });
      }
      
      Alert.alert('Éxito', 'Datos actualizados correctamente');
      setShowMisDatos(false);
    } catch (error) {
      console.error('Error updating user:', error);
      Alert.alert('Error', 'No se pudieron actualizar los datos');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      try {
        await logout();
        window.location.href = '/login';
      } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/login';
      }
    } else {
      Alert.alert(
        'Cerrar Sesión',
        '¿Estás seguro que deseas salir?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Salir',
            style: 'destructive',
            onPress: async () => {
              try {
                await logout();
                router.replace('/login');
              } catch (error) {
                console.error('Logout error:', error);
                router.replace('/login');
              }
            },
          },
        ]
      );
    }
  };

  const displayName = user?.first_name 
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.name || 'Usuario';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Perfil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={48} color="#FF5000" />
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {user?.is_admin && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={16} color="#FFF" />
              <Text style={styles.adminBadgeText}>Administrador</Text>
            </View>
          )}
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo Disponible</Text>
          <Text style={styles.balanceAmount}>${user?.balance?.toFixed(2) || '0.00'}</Text>
          <Text style={styles.balanceNote}>(Solo informativo)</Text>
        </View>

        {/* Admin Access */}
        {user?.is_admin && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/admin')}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="settings" size={24} color="#FF5000" />
            </View>
            <Text style={styles.menuText}>Panel de Administración</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        )}

        {/* Menu Items */}
        <View style={styles.menuCard}>
          {/* MIS DATOS - NUEVO */}
          <TouchableOpacity style={styles.menuItem} onPress={openMisDatos}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="person-circle" size={24} color="#FF5000" />
            </View>
            <Text style={styles.menuText}>Mis Datos</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="notifications" size={24} color="#666" />
            </View>
            <Text style={styles.menuText}>Notificaciones</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="lock-closed" size={24} color="#666" />
            </View>
            <Text style={styles.menuText}>Cambiar Contraseña</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="document-text" size={24} color="#666" />
            </View>
            <Text style={styles.menuText}>Términos y Condiciones</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="shield" size={24} color="#666" />
            </View>
            <Text style={styles.menuText}>Política de Privacidad</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={24} color="#F44336" />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Versión 1.0.0</Text>
      </ScrollView>

      {/* Modal Mis Datos */}
      <Modal
        visible={showMisDatos}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMisDatos(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mis Datos</Text>
              <TouchableOpacity onPress={() => setShowMisDatos(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  value={editingData.first_name}
                  onChangeText={(text) => setEditingData({...editingData, first_name: text})}
                  placeholder="Tu nombre"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Apellido</Text>
                <TextInput
                  style={styles.input}
                  value={editingData.last_name}
                  onChangeText={(text) => setEditingData({...editingData, last_name: text})}
                  placeholder="Tu apellido"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Teléfono</Text>
                <TextInput
                  style={styles.input}
                  value={editingData.phone_number}
                  onChangeText={(text) => setEditingData({...editingData, phone_number: text})}
                  placeholder="04XX-XXXXXXX"
                  keyboardType="phone-pad"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Correo Electrónico</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={editingData.email}
                  editable={false}
                  placeholderTextColor="#999"
                />
                <Text style={styles.inputHint}>El correo no puede ser modificado</Text>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
              onPress={handleSaveMisDatos}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="save" size={20} color="#FFF" />
                  <Text style={styles.saveButtonText}>Guardar Cambios</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#FFF',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  userCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF5000',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    gap: 4,
  },
  adminBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  balanceCard: {
    backgroundColor: '#FF5000',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFF',
  },
  balanceNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  menuCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFEBEE',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
  },
  inputDisabled: {
    backgroundColor: '#EEEEEE',
    color: '#999',
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF5000',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
