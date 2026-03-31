import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Order {
  id: string;
  user_name: string;
  user_email: string;
  zinli_amount: number;
  total_cost: number;
  payment_method: string;
  reference_number: string;
  payment_proof_image: string;
  status: string;
  created_at: string;
  order_type: string;
  zinli_email?: string;
}

export default function AdminPanel() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'orders' | 'config' | 'password' | 'users' | 'banners' | 'payments'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [exchangeRate, setExchangeRate] = useState('');
  const [commission, setCommission] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Users management states
  const [users, setUsers] = useState<any[]>([]);
  
  // Banners management states
  const [banners, setBanners] = useState<any[]>([]);
  
  // Payment methods states
  const [bankDetails, setBankDetails] = useState<any>(null);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const session = await AsyncStorage.getItem('admin_session');
      if (session !== 'true') {
        router.replace('/admin-login');
        return;
      }
      loadData();
    } catch (error) {
      router.replace('/admin-login');
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('admin_session');
      router.push('/admin-login');
    } catch (error) {
      console.error('Error logging out:', error);
      router.push('/admin-login');
    }
  };

  const loadData = async () => {
    try {
      const adminHeaders = { 'X-Admin-Secret': 'zinli-admin-2024' };
      
      const [ordersRes, configRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/orders`, { headers: adminHeaders }),
        axios.get(`${BACKEND_URL}/api/config`),
      ]);

      setOrders(ordersRes.data);
      setExchangeRate(configRes.data.exchange_rate.toString());
      setCommission(configRes.data.commission_percent.toString());
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleUpdateOrder = async (orderId: string, status: string) => {
    try {
      await axios.patch(
        `${BACKEND_URL}/api/admin/orders/${orderId}`,
        { status },
        { headers: { 'X-Admin-Secret': 'zinli-admin-2024' } }
      );

      Alert.alert('Éxito', `Pedido ${status === 'completed' ? 'aprobado' : 'rechazado'} correctamente`);
      setSelectedOrder(null);
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el pedido');
    }
  };

  const handleUpdateConfig = async () => {
    if (!exchangeRate || !commission) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    try {
      await axios.patch(
        `${BACKEND_URL}/api/admin/config`,
        {
          exchange_rate: parseFloat(exchangeRate),
          commission_percent: parseFloat(commission),
        },
        { headers: { 'X-Admin-Secret': 'zinli-admin-2024' } }
      );

      Alert.alert('Éxito', 'Configuración actualizada correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar la configuración');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas nuevas no coinciden');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setChangingPassword(true);
    try {
      // Verificar contraseña actual
      const savedPassword = await AsyncStorage.getItem('admin_password');
      const correctPassword = savedPassword || 'admin123';

      if (currentPassword !== correctPassword) {
        Alert.alert('Error', 'La contraseña actual es incorrecta');
        setChangingPassword(false);
        return;
      }

      // Guardar nueva contraseña
      await AsyncStorage.setItem('admin_password', newPassword);
      
      Alert.alert('Éxito', 'Contraseña actualizada correctamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      Alert.alert('Error', 'No se pudo cambiar la contraseña');
    } finally {
      setChangingPassword(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FFA500';
      case 'completed':
        return '#4CAF50';
      case 'rejected':
        return '#F44336';
      default:
        return '#999';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'completed':
        return 'Completado';
      case 'rejected':
        return 'Rechazado';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF5000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Panel Admin</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out" size={24} color="#FF5000" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'orders' && styles.tabActive]}
          onPress={() => setActiveTab('orders')}
        >
          <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>
            Pedidos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'config' && styles.tabActive]}
          onPress={() => setActiveTab('config')}
        >
          <Text style={[styles.tabText, activeTab === 'config' && styles.tabTextActive]}>
            Configuración
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'password' && styles.tabActive]}
          onPress={() => setActiveTab('password')}
        >
          <Text style={[styles.tabText, activeTab === 'password' && styles.tabTextActive]}>
            Contraseña
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5000" />
        }
      >
        {activeTab === 'orders' && (
          <View>
            {orders.filter(o => o.status === 'pending').length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={64} color="#CCC" />
                <Text style={styles.emptyText}>No hay pedidos pendientes</Text>
              </View>
            ) : (
              orders
                .filter(o => o.status === 'pending')
                .map((order) => (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <View>
                        <Text style={styles.orderUser}>{order.user_name}</Text>
                        <Text style={styles.orderEmail}>{order.user_email}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                        <Text style={styles.statusText}>{getStatusText(order.status)}</Text>
                      </View>
                    </View>

                    <View style={styles.orderAmount}>
                      <Text style={styles.orderAmountLabel}>
                        {order.order_type === 'gift_card' ? 'Gift Card' : 'Recarga Zinli'}:
                      </Text>
                      <Text style={styles.orderAmountValue}>${order.zinli_amount} USD</Text>
                    </View>

                    {order.zinli_email && (
                      <View style={styles.orderDetail}>
                        <Text style={styles.orderDetailLabel}>Email Zinli:</Text>
                        <Text style={styles.orderDetailValue}>{order.zinli_email}</Text>
                      </View>
                    )}

                    <View style={styles.orderDetail}>
                      <Text style={styles.orderDetailLabel}>Total pagado:</Text>
                      <Text style={styles.orderDetailValue}>{order.total_cost} Bs</Text>
                    </View>

                    <View style={styles.orderDetail}>
                      <Text style={styles.orderDetailLabel}>Referencia:</Text>
                      <Text style={styles.orderDetailValue}>{order.reference_number}</Text>
                    </View>

                    <View style={styles.orderDetail}>
                      <Text style={styles.orderDetailLabel}>Fecha:</Text>
                      <Text style={styles.orderDetailValue}>{formatDate(order.created_at)}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.viewProofButton}
                      onPress={() => setSelectedOrder(order)}
                    >
                      <Ionicons name="image" size={20} color="#FF5000" />
                      <Text style={styles.viewProofText}>Ver Comprobante</Text>
                    </TouchableOpacity>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() =>
                          Alert.alert(
                            'Aprobar Pedido',
                            '¿Estás seguro de aprobar este pedido?',
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              {
                                text: 'Aprobar',
                                onPress: () => handleUpdateOrder(order.id, 'completed'),
                              },
                            ]
                          )
                        }
                      >
                        <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                        <Text style={styles.actionButtonText}>Aprobar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() =>
                          Alert.alert(
                            'Rechazar Pedido',
                            '¿Estás seguro de rechazar este pedido?',
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              {
                                text: 'Rechazar',
                                style: 'destructive',
                                onPress: () => handleUpdateOrder(order.id, 'rejected'),
                              },
                            ]
                          )
                        }
                      >
                        <Ionicons name="close-circle" size={20} color="#FFF" />
                        <Text style={styles.actionButtonText}>Rechazar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
            )}
          </View>
        )}

        {activeTab === 'config' && (
          <View>
            <View style={styles.configCard}>
              <Text style={styles.configTitle}>Tasa de Cambio</Text>
              <Text style={styles.configDescription}>1 USD = X Bolívares</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Tasa (Bs):</Text>
                <TextInput
                  style={styles.input}
                  placeholder="50.00"
                  value={exchangeRate}
                  onChangeText={setExchangeRate}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            <View style={styles.configCard}>
              <Text style={styles.configTitle}>Comisión</Text>
              <Text style={styles.configDescription}>Porcentaje de comisión por transacción</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Comisión (%):</Text>
                <TextInput
                  style={styles.input}
                  placeholder="3.0"
                  value={commission}
                  onChangeText={setCommission}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleUpdateConfig}>
              <Ionicons name="save" size={24} color="#FFF" />
              <Text style={styles.saveButtonText}>Guardar Cambios</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'password' && (
          <View>
            <View style={styles.passwordCard}>
              <Ionicons name="lock-closed" size={48} color="#FF5000" style={{ alignSelf: 'center', marginBottom: 16 }} />
              <Text style={styles.configTitle}>Cambiar Contraseña</Text>
              <Text style={styles.configDescription}>Actualiza tu contraseña de acceso al panel</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Contraseña Actual:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ingresa tu contraseña actual"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Nueva Contraseña:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirmar Nueva Contraseña:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Repite la nueva contraseña"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholderTextColor="#999"
                />
              </View>

              <TouchableOpacity 
                style={[styles.saveButton, changingPassword && { opacity: 0.6 }]} 
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="key" size={24} color="#FFF" />
                    <Text style={styles.saveButtonText}>Actualizar Contraseña</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Image Modal */}
      {selectedOrder && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedOrder(null)}
        >
          <View style={styles.modal}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Comprobante de Pago</Text>
                <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              <ScrollView>
                <Image
                  source={{ uri: selectedOrder.payment_proof_image }}
                  style={styles.proofImage}
                  resizeMode="contain"
                />
                <Text style={styles.modalReference}>
                  Referencia: {selectedOrder.reference_number}
                </Text>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    padding: 8,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF5000',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#FF5000',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 24,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  orderUser: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  orderEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  orderAmount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  orderAmountLabel: {
    fontSize: 14,
    color: '#666',
  },
  orderAmountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF5000',
  },
  orderDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderDetailLabel: {
    fontSize: 14,
    color: '#666',
  },
  orderDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  viewProofButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#FFF5F0',
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  viewProofText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF5000',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 6,
  },
  configCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  passwordCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  configTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  configDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  inputContainer: {
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#FF5000',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF5000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 8,
  },
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  proofImage: {
    width: '100%',
    height: 400,
    borderRadius: 12,
  },
  modalReference: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
});
