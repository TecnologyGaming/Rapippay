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
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const ADMIN_HEADERS = { 'X-Admin-Secret': 'zinli-admin-2024' };

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

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  is_admin: boolean;
  is_active: boolean;
  order_count: number;
  created_at: string;
}

interface Banner {
  id: string;
  image_base64: string;
  link?: string;
  order: number;
  is_active: boolean;
}

interface SocialNetwork {
  id: string;
  platform: string;
  url: string;
  is_active: boolean;
}

interface PaymentMethod {
  id: string;
  name: string;
  logo_base64?: string;
  fields: Record<string, string>;
  is_active: boolean;
}

export default function AdminPanel() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'orders' | 'config' | 'password' | 'users' | 'banners' | 'payments' | 'branding' | 'contact'>('orders');
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
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [resetPasswordModal, setResetPasswordModal] = useState<User | null>(null);
  const [newUserPassword, setNewUserPassword] = useState('');
  
  // Banners management states
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [newBannerLink, setNewBannerLink] = useState('');
  
  // Branding states
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [faviconBase64, setFaviconBase64] = useState<string | null>(null);
  
  // Contact states
  const [contactInfo, setContactInfo] = useState({ phone: '', email: '', whatsapp: '' });
  const [socialNetworks, setSocialNetworks] = useState<SocialNetwork[]>([]);
  const [newSocialPlatform, setNewSocialPlatform] = useState('instagram');
  const [newSocialUrl, setNewSocialUrl] = useState('');
  
  // Payment methods states (NEW DYNAMIC)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [newPaymentName, setNewPaymentName] = useState('');
  const [newPaymentFields, setNewPaymentFields] = useState<{key: string, value: string}[]>([{key: '', value: ''}]);
  const [newPaymentLogo, setNewPaymentLogo] = useState<string | null>(null);

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
      const [ordersRes, configRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/orders`, { headers: ADMIN_HEADERS }).catch(() => ({ data: [] })),
        axios.get(`${BACKEND_URL}/api/config`),
      ]);

      setOrders(ordersRes.data || []);
      setExchangeRate(configRes.data.exchange_rate.toString());
      setCommission(configRes.data.commission_percent.toString());
      
      // Branding
      setLogoBase64(configRes.data.logo_base64 || null);
      setFaviconBase64(configRes.data.favicon_base64 || null);
      
      // Contact info
      if (configRes.data.contact_info) {
        setContactInfo(configRes.data.contact_info);
      }
      
      // Social networks
      if (configRes.data.social_networks) {
        setSocialNetworks(configRes.data.social_networks);
      }
      
      // Payment methods (NEW)
      if (configRes.data.payment_methods) {
        setPaymentMethods(configRes.data.payment_methods);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  // Load Users
  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/admin/users`, { headers: ADMIN_HEADERS });
      setUsers(res.data);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'No se pudieron cargar los usuarios');
    } finally {
      setUsersLoading(false);
    }
  };

  // Load Banners
  const loadBanners = async () => {
    setBannersLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/banners`);
      setBanners(res.data);
    } catch (error) {
      console.error('Error loading banners:', error);
    } finally {
      setBannersLoading(false);
    }
  };

  // Toggle user status
  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await axios.patch(
        `${BACKEND_URL}/api/admin/users/${userId}/toggle-status`,
        {},
        { headers: ADMIN_HEADERS }
      );
      Alert.alert('Éxito', `Usuario ${currentStatus ? 'desactivado' : 'activado'} correctamente`);
      loadUsers();
    } catch (error) {
      Alert.alert('Error', 'No se pudo cambiar el estado del usuario');
    }
  };

  // Reset user password
  const handleResetPassword = async () => {
    if (!resetPasswordModal || !newUserPassword) {
      Alert.alert('Error', 'Ingresa la nueva contraseña');
      return;
    }
    try {
      await axios.post(
        `${BACKEND_URL}/api/admin/users/${resetPasswordModal.id}/reset-password`,
        { password: newUserPassword },
        { headers: ADMIN_HEADERS }
      );
      Alert.alert('Éxito', 'Contraseña restablecida correctamente');
      setResetPasswordModal(null);
      setNewUserPassword('');
    } catch (error) {
      Alert.alert('Error', 'No se pudo restablecer la contraseña');
    }
  };

  // Add new banner
  const handleAddBanner = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        await axios.post(
          `${BACKEND_URL}/api/admin/banners`,
          {
            image_base64: base64Image,
            link: newBannerLink || null,
            order: banners.length,
          },
          { headers: ADMIN_HEADERS }
        );
        Alert.alert('Éxito', 'Banner agregado correctamente');
        setNewBannerLink('');
        loadBanners();
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo agregar el banner');
    }
  };

  // Delete banner
  const handleDeleteBanner = async (bannerId: string) => {
    Alert.alert(
      'Eliminar Banner',
      '¿Estás seguro de eliminar este banner?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${BACKEND_URL}/api/admin/banners/${bannerId}`, { headers: ADMIN_HEADERS });
              Alert.alert('Éxito', 'Banner eliminado');
              loadBanners();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar el banner');
            }
          },
        },
      ]
    );
  };

  // Save payment methods
  const handleSavePaymentMethods = async () => {
    try {
      await axios.put(
        `${BACKEND_URL}/api/admin/payment-methods`,
        paymentMethods,
        { headers: ADMIN_HEADERS }
      );
      setEditingPaymentId(null);
      Alert.alert('Éxito', 'Métodos de pago actualizados correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudieron guardar los cambios');
    }
  };

  // Toggle payment method active status
  const handleTogglePaymentMethod = async (methodId: string) => {
    try {
      await axios.patch(
        `${BACKEND_URL}/api/admin/payment-methods/${methodId}/toggle`,
        {},
        { headers: ADMIN_HEADERS }
      );
      // Update local state
      setPaymentMethods(prev => prev.map(m => 
        m.id === methodId ? { ...m, is_active: !m.is_active } : m
      ));
    } catch (error) {
      Alert.alert('Error', 'No se pudo cambiar el estado');
    }
  };

  // Add new payment method
  const handleAddPaymentMethod = async () => {
    if (!newPaymentName.trim()) {
      Alert.alert('Error', 'Ingresa el nombre del método de pago');
      return;
    }

    const fields: Record<string, string> = {};
    newPaymentFields.forEach(f => {
      if (f.key.trim()) fields[f.key] = f.value;
    });

    const newMethod: PaymentMethod = {
      id: `pm_${Date.now()}`,
      name: newPaymentName,
      logo_base64: newPaymentLogo,
      fields,
      is_active: true
    };

    const updatedMethods = [...paymentMethods, newMethod];
    
    try {
      await axios.put(
        `${BACKEND_URL}/api/admin/payment-methods`,
        updatedMethods,
        { headers: ADMIN_HEADERS }
      );
      setPaymentMethods(updatedMethods);
      setShowAddPaymentModal(false);
      setNewPaymentName('');
      setNewPaymentFields([{key: '', value: ''}]);
      setNewPaymentLogo(null);
      Alert.alert('Éxito', 'Método de pago agregado');
    } catch (error) {
      Alert.alert('Error', 'No se pudo agregar el método');
    }
  };

  // Delete payment method
  const handleDeletePaymentMethod = (methodId: string) => {
    Alert.alert(
      'Eliminar Método',
      '¿Estás seguro de eliminar este método de pago?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const updatedMethods = paymentMethods.filter(m => m.id !== methodId);
            try {
              await axios.put(
                `${BACKEND_URL}/api/admin/payment-methods`,
                updatedMethods,
                { headers: ADMIN_HEADERS }
              );
              setPaymentMethods(updatedMethods);
              Alert.alert('Éxito', 'Método eliminado');
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar');
            }
          },
        },
      ]
    );
  };

  // Pick payment method logo
  const handlePickPaymentLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setNewPaymentLogo(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  // Update branding (logo/favicon)
  const handleUpdateBranding = async (type: 'logo' | 'favicon') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'logo' ? [4, 1] : [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/png;base64,${result.assets[0].base64}`;
      try {
        await axios.patch(
          `${BACKEND_URL}/api/admin/branding`,
          type === 'logo' ? { logo_base64: base64Image } : { favicon_base64: base64Image },
          { headers: ADMIN_HEADERS }
        );
        if (type === 'logo') setLogoBase64(base64Image);
        else setFaviconBase64(base64Image);
        Alert.alert('Éxito', `${type === 'logo' ? 'Logo' : 'Favicon'} actualizado`);
      } catch (error) {
        Alert.alert('Error', 'No se pudo actualizar');
      }
    }
  };

  // Save contact info
  const handleSaveContactInfo = async () => {
    try {
      await axios.patch(
        `${BACKEND_URL}/api/admin/contact`,
        contactInfo,
        { headers: ADMIN_HEADERS }
      );
      Alert.alert('Éxito', 'Información de contacto actualizada');
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar');
    }
  };

  // Add social network
  const handleAddSocialNetwork = async () => {
    if (!newSocialUrl.trim()) {
      Alert.alert('Error', 'Ingresa la URL de la red social');
      return;
    }

    const newNetwork: SocialNetwork = {
      id: `sn_${Date.now()}`,
      platform: newSocialPlatform,
      url: newSocialUrl,
      is_active: true
    };

    const updatedNetworks = [...socialNetworks, newNetwork];
    
    try {
      await axios.put(
        `${BACKEND_URL}/api/admin/social-networks`,
        updatedNetworks,
        { headers: ADMIN_HEADERS }
      );
      setSocialNetworks(updatedNetworks);
      setNewSocialUrl('');
      Alert.alert('Éxito', 'Red social agregada');
    } catch (error) {
      Alert.alert('Error', 'No se pudo agregar');
    }
  };

  // Delete social network
  const handleDeleteSocialNetwork = async (networkId: string) => {
    const updatedNetworks = socialNetworks.filter(n => n.id !== networkId);
    try {
      await axios.put(
        `${BACKEND_URL}/api/admin/social-networks`,
        updatedNetworks,
        { headers: ADMIN_HEADERS }
      );
      setSocialNetworks(updatedNetworks);
    } catch (error) {
      Alert.alert('Error', 'No se pudo eliminar');
    }
  };

  // Get social icon
  const getSocialIcon = (platform: string) => {
    const icons: Record<string, string> = {
      instagram: 'logo-instagram',
      facebook: 'logo-facebook',
      twitter: 'logo-twitter',
      tiktok: 'logo-tiktok',
      youtube: 'logo-youtube',
      whatsapp: 'logo-whatsapp',
      linkedin: 'logo-linkedin',
      telegram: 'paper-plane',
    };
    return icons[platform] || 'link';
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
        { headers: ADMIN_HEADERS }
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
        { headers: ADMIN_HEADERS }
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

      {/* Tabs - Now scrollable with 8 tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'orders' && styles.tabActive]}
            onPress={() => setActiveTab('orders')}
          >
            <Ionicons name="receipt" size={18} color={activeTab === 'orders' ? '#FF5000' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>
              Pedidos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'users' && styles.tabActive]}
            onPress={() => { setActiveTab('users'); loadUsers(); }}
          >
            <Ionicons name="people" size={18} color={activeTab === 'users' ? '#FF5000' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
              Usuarios
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'banners' && styles.tabActive]}
            onPress={() => { setActiveTab('banners'); loadBanners(); }}
          >
            <Ionicons name="images" size={18} color={activeTab === 'banners' ? '#FF5000' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'banners' && styles.tabTextActive]}>
              Banners
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'payments' && styles.tabActive]}
            onPress={() => setActiveTab('payments')}
          >
            <Ionicons name="card" size={18} color={activeTab === 'payments' ? '#FF5000' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive]}>
              Pagos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'branding' && styles.tabActive]}
            onPress={() => setActiveTab('branding')}
          >
            <Ionicons name="color-palette" size={18} color={activeTab === 'branding' ? '#FF5000' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'branding' && styles.tabTextActive]}>
              Marca
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'contact' && styles.tabActive]}
            onPress={() => setActiveTab('contact')}
          >
            <Ionicons name="call" size={18} color={activeTab === 'contact' ? '#FF5000' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'contact' && styles.tabTextActive]}>
              Contacto
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'config' && styles.tabActive]}
            onPress={() => setActiveTab('config')}
          >
            <Ionicons name="settings" size={18} color={activeTab === 'config' ? '#FF5000' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'config' && styles.tabTextActive]}>
              Config
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'password' && styles.tabActive]}
            onPress={() => setActiveTab('password')}
          >
            <Ionicons name="key" size={18} color={activeTab === 'password' ? '#FF5000' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'password' && styles.tabTextActive]}>
              Clave
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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

        {/* ===== USERS TAB ===== */}
        {activeTab === 'users' && (
          <View>
            <Text style={styles.sectionTitle}>Gestión de Usuarios</Text>
            {usersLoading ? (
              <ActivityIndicator size="large" color="#FF5000" style={{ marginTop: 40 }} />
            ) : users.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color="#CCC" />
                <Text style={styles.emptyText}>No hay usuarios registrados</Text>
              </View>
            ) : (
              users.map((user) => (
                <View key={user.id} style={styles.userCard}>
                  <View style={styles.userHeader}>
                    <View style={styles.userAvatar}>
                      <Text style={styles.userInitials}>
                        {(user.first_name?.[0] || 'U').toUpperCase()}
                        {(user.last_name?.[0] || '').toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{user.first_name} {user.last_name}</Text>
                      <Text style={styles.userEmail}>{user.email}</Text>
                      <Text style={styles.userPhone}>{user.phone_number}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: user.is_active ? '#4CAF50' : '#F44336' }]}>
                      <Text style={styles.statusText}>{user.is_active ? 'Activo' : 'Inactivo'}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.userStats}>
                    <View style={styles.statItem}>
                      <Ionicons name="cart" size={16} color="#666" />
                      <Text style={styles.statText}>{user.order_count} pedidos</Text>
                    </View>
                    {user.is_admin && (
                      <View style={[styles.statusBadge, { backgroundColor: '#FF5000' }]}>
                        <Text style={styles.statusText}>Admin</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.userActions}>
                    <TouchableOpacity
                      style={[styles.userActionBtn, { backgroundColor: user.is_active ? '#FFF3E0' : '#E8F5E9' }]}
                      onPress={() => handleToggleUserStatus(user.id, user.is_active)}
                    >
                      <Ionicons 
                        name={user.is_active ? 'close-circle' : 'checkmark-circle'} 
                        size={18} 
                        color={user.is_active ? '#FF9800' : '#4CAF50'} 
                      />
                      <Text style={[styles.userActionText, { color: user.is_active ? '#FF9800' : '#4CAF50' }]}>
                        {user.is_active ? 'Desactivar' : 'Activar'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.userActionBtn, { backgroundColor: '#E3F2FD' }]}
                      onPress={() => setResetPasswordModal(user)}
                    >
                      <Ionicons name="key" size={18} color="#2196F3" />
                      <Text style={[styles.userActionText, { color: '#2196F3' }]}>Resetear Clave</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ===== BANNERS TAB ===== */}
        {activeTab === 'banners' && (
          <View>
            <Text style={styles.sectionTitle}>Gestión de Banners</Text>
            
            {/* Add Banner Section */}
            <View style={styles.addBannerCard}>
              <Text style={styles.configTitle}>Agregar Nuevo Banner</Text>
              <TextInput
                style={styles.input}
                placeholder="Link del banner (opcional)"
                value={newBannerLink}
                onChangeText={setNewBannerLink}
                placeholderTextColor="#999"
              />
              <TouchableOpacity style={styles.saveButton} onPress={handleAddBanner}>
                <Ionicons name="add-circle" size={24} color="#FFF" />
                <Text style={styles.saveButtonText}>Seleccionar Imagen</Text>
              </TouchableOpacity>
            </View>

            {/* Banners List */}
            {bannersLoading ? (
              <ActivityIndicator size="large" color="#FF5000" style={{ marginTop: 20 }} />
            ) : banners.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="images-outline" size={64} color="#CCC" />
                <Text style={styles.emptyText}>No hay banners</Text>
              </View>
            ) : (
              banners.map((banner, index) => (
                <View key={banner.id} style={styles.bannerCard}>
                  <Image
                    source={{ uri: banner.image_base64 }}
                    style={styles.bannerPreview}
                    resizeMode="cover"
                  />
                  <View style={styles.bannerInfo}>
                    <Text style={styles.bannerOrder}>Orden: {index + 1}</Text>
                    {banner.link && <Text style={styles.bannerLink} numberOfLines={1}>Link: {banner.link}</Text>}
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBannerBtn}
                    onPress={() => handleDeleteBanner(banner.id)}
                  >
                    <Ionicons name="trash" size={20} color="#F44336" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* ===== PAYMENT METHODS TAB (DYNAMIC) ===== */}
        {activeTab === 'payments' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Métodos de Pago</Text>
              <TouchableOpacity 
                style={styles.addButton} 
                onPress={() => setShowAddPaymentModal(true)}
              >
                <Ionicons name="add-circle" size={24} color="#FF5000" />
                <Text style={styles.addButtonText}>Agregar</Text>
              </TouchableOpacity>
            </View>

            {paymentMethods.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="card-outline" size={64} color="#CCC" />
                <Text style={styles.emptyText}>No hay métodos de pago</Text>
              </View>
            ) : (
              paymentMethods.map((method) => (
                <View key={method.id} style={[styles.paymentCard, !method.is_active && { opacity: 0.6 }]}>
                  <View style={styles.paymentHeader}>
                    {method.logo_base64 ? (
                      <Image source={{ uri: method.logo_base64 }} style={styles.paymentLogo} />
                    ) : (
                      <Ionicons name="card" size={24} color="#FF5000" />
                    )}
                    <Text style={styles.paymentTitle}>{method.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={() => handleTogglePaymentMethod(method.id)}>
                        <Ionicons 
                          name={method.is_active ? 'eye' : 'eye-off'} 
                          size={22} 
                          color={method.is_active ? '#4CAF50' : '#999'} 
                        />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingPaymentId(editingPaymentId === method.id ? null : method.id)}>
                        <Ionicons name={editingPaymentId === method.id ? 'close' : 'create'} size={22} color="#666" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeletePaymentMethod(method.id)}>
                        <Ionicons name="trash" size={22} color="#F44336" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {editingPaymentId === method.id ? (
                    <View style={styles.paymentDetails}>
                      {Object.entries(method.fields).map(([key, value]) => (
                        <TextInput
                          key={key}
                          style={styles.input}
                          placeholder={key}
                          value={value}
                          onChangeText={(text) => {
                            setPaymentMethods(prev => prev.map(m => 
                              m.id === method.id 
                                ? { ...m, fields: { ...m.fields, [key]: text } }
                                : m
                            ));
                          }}
                          placeholderTextColor="#999"
                        />
                      ))}
                      <TouchableOpacity style={styles.saveButton} onPress={handleSavePaymentMethods}>
                        <Ionicons name="save" size={20} color="#FFF" />
                        <Text style={styles.saveButtonText}>Guardar</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.paymentDetails}>
                      {Object.entries(method.fields).map(([key, value]) => (
                        <Text key={key} style={styles.paymentDetailText}>
                          {key}: {value || 'No configurado'}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* ===== BRANDING TAB ===== */}
        {activeTab === 'branding' && (
          <View>
            <Text style={styles.sectionTitle}>Marca y Diseño</Text>
            
            {/* Logo */}
            <View style={styles.brandingCard}>
              <Text style={styles.configTitle}>Logo de la App</Text>
              <Text style={styles.configDescription}>Se mostrará en el header y login</Text>
              {logoBase64 ? (
                <Image source={{ uri: logoBase64 }} style={styles.logoPreview} resizeMode="contain" />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="image-outline" size={48} color="#CCC" />
                  <Text style={styles.placeholderText}>Sin logo</Text>
                </View>
              )}
              <TouchableOpacity style={styles.saveButton} onPress={() => handleUpdateBranding('logo')}>
                <Ionicons name="cloud-upload" size={24} color="#FFF" />
                <Text style={styles.saveButtonText}>Cambiar Logo</Text>
              </TouchableOpacity>
            </View>

            {/* Favicon */}
            <View style={styles.brandingCard}>
              <Text style={styles.configTitle}>Favicon</Text>
              <Text style={styles.configDescription}>Ícono que se muestra en el navegador</Text>
              {faviconBase64 ? (
                <Image source={{ uri: faviconBase64 }} style={styles.faviconPreview} resizeMode="contain" />
              ) : (
                <View style={styles.faviconPlaceholder}>
                  <Ionicons name="image-outline" size={32} color="#CCC" />
                </View>
              )}
              <TouchableOpacity style={styles.saveButton} onPress={() => handleUpdateBranding('favicon')}>
                <Ionicons name="cloud-upload" size={24} color="#FFF" />
                <Text style={styles.saveButtonText}>Cambiar Favicon</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ===== CONTACT TAB ===== */}
        {activeTab === 'contact' && (
          <View>
            <Text style={styles.sectionTitle}>Información de Contacto</Text>
            
            {/* Contact Info */}
            <View style={styles.contactCard}>
              <Text style={styles.configTitle}>Datos de Contacto</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Teléfono:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+58 412-1234567"
                  value={contactInfo.phone}
                  onChangeText={(t) => setContactInfo({...contactInfo, phone: t})}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Correo Electrónico:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="contacto@ejemplo.com"
                  value={contactInfo.email}
                  onChangeText={(t) => setContactInfo({...contactInfo, email: t})}
                  keyboardType="email-address"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>WhatsApp:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+58 412-1234567"
                  value={contactInfo.whatsapp}
                  onChangeText={(t) => setContactInfo({...contactInfo, whatsapp: t})}
                  placeholderTextColor="#999"
                />
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveContactInfo}>
                <Ionicons name="save" size={24} color="#FFF" />
                <Text style={styles.saveButtonText}>Guardar Contacto</Text>
              </TouchableOpacity>
            </View>

            {/* Social Networks */}
            <View style={styles.contactCard}>
              <Text style={styles.configTitle}>Redes Sociales</Text>
              
              {/* Add new social */}
              <View style={styles.addSocialRow}>
                <View style={styles.socialPickerContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['instagram', 'facebook', 'twitter', 'tiktok', 'youtube', 'whatsapp', 'telegram'].map(platform => (
                      <TouchableOpacity
                        key={platform}
                        style={[styles.socialPickerItem, newSocialPlatform === platform && styles.socialPickerItemActive]}
                        onPress={() => setNewSocialPlatform(platform)}
                      >
                        <Ionicons name={getSocialIcon(platform) as any} size={20} color={newSocialPlatform === platform ? '#FF5000' : '#666'} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="https://instagram.com/tu_usuario"
                  value={newSocialUrl}
                  onChangeText={setNewSocialUrl}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity style={styles.addSocialBtn} onPress={handleAddSocialNetwork}>
                  <Ionicons name="add" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>

              {/* List of social networks */}
              {socialNetworks.map(network => (
                <View key={network.id} style={styles.socialItem}>
                  <Ionicons name={getSocialIcon(network.platform) as any} size={24} color="#FF5000" />
                  <Text style={styles.socialUrl} numberOfLines={1}>{network.url}</Text>
                  <TouchableOpacity onPress={() => handleDeleteSocialNetwork(network.id)}>
                    <Ionicons name="trash" size={20} color="#F44336" />
                  </TouchableOpacity>
                </View>
              ))}

              {socialNetworks.length === 0 && (
                <Text style={styles.noSocialText}>No hay redes sociales configuradas</Text>
              )}
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

      {/* Reset Password Modal */}
      {resetPasswordModal && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => { setResetPasswordModal(null); setNewUserPassword(''); }}
        >
          <View style={styles.modal}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Resetear Contraseña</Text>
                <TouchableOpacity onPress={() => { setResetPasswordModal(null); setNewUserPassword(''); }}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>Usuario: {resetPasswordModal.email}</Text>
              <TextInput
                style={[styles.input, { marginTop: 16 }]}
                placeholder="Nueva contraseña"
                value={newUserPassword}
                onChangeText={setNewUserPassword}
                secureTextEntry
                placeholderTextColor="#999"
              />
              <TouchableOpacity style={styles.saveButton} onPress={handleResetPassword}>
                <Ionicons name="key" size={24} color="#FFF" />
                <Text style={styles.saveButtonText}>Resetear Contraseña</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Add Payment Method Modal */}
      {showAddPaymentModal && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowAddPaymentModal(false)}
        >
          <View style={styles.modal}>
            <View style={[styles.modalContent, { maxHeight: '80%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Agregar Método de Pago</Text>
                <TouchableOpacity onPress={() => { setShowAddPaymentModal(false); setNewPaymentName(''); setNewPaymentFields([{key: '', value: ''}]); setNewPaymentLogo(null); }}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={{ maxHeight: 400 }}>
                {/* Logo */}
                <TouchableOpacity style={styles.logoPickerBtn} onPress={handlePickPaymentLogo}>
                  {newPaymentLogo ? (
                    <Image source={{ uri: newPaymentLogo }} style={styles.newPaymentLogo} />
                  ) : (
                    <>
                      <Ionicons name="image" size={32} color="#999" />
                      <Text style={styles.logoPickerText}>Agregar Logo</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Name */}
                <TextInput
                  style={styles.input}
                  placeholder="Nombre del método (ej: Zelle, Nequi)"
                  value={newPaymentName}
                  onChangeText={setNewPaymentName}
                  placeholderTextColor="#999"
                />

                {/* Dynamic Fields */}
                <Text style={styles.inputLabel}>Campos de información:</Text>
                {newPaymentFields.map((field, index) => (
                  <View key={index} style={styles.fieldRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      placeholder="Nombre del campo"
                      value={field.key}
                      onChangeText={(text) => {
                        const updated = [...newPaymentFields];
                        updated[index].key = text;
                        setNewPaymentFields(updated);
                      }}
                      placeholderTextColor="#999"
                    />
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0, marginLeft: 8 }]}
                      placeholder="Valor"
                      value={field.value}
                      onChangeText={(text) => {
                        const updated = [...newPaymentFields];
                        updated[index].value = text;
                        setNewPaymentFields(updated);
                      }}
                      placeholderTextColor="#999"
                    />
                    <TouchableOpacity 
                      style={styles.removeFieldBtn}
                      onPress={() => {
                        if (newPaymentFields.length > 1) {
                          setNewPaymentFields(newPaymentFields.filter((_, i) => i !== index));
                        }
                      }}
                    >
                      <Ionicons name="remove-circle" size={24} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity 
                  style={styles.addFieldBtn}
                  onPress={() => setNewPaymentFields([...newPaymentFields, {key: '', value: ''}])}
                >
                  <Ionicons name="add-circle" size={20} color="#FF5000" />
                  <Text style={styles.addFieldText}>Agregar Campo</Text>
                </TouchableOpacity>
              </ScrollView>

              <TouchableOpacity style={styles.saveButton} onPress={handleAddPaymentMethod}>
                <Ionicons name="add-circle" size={24} color="#FFF" />
                <Text style={styles.saveButtonText}>Crear Método de Pago</Text>
              </TouchableOpacity>
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
    paddingHorizontal: 8,
  },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
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
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  // Tabs container for scrollable tabs
  tabsContainer: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  // Section title
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  // User styles
  userCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF5000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userInitials: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  userPhone: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  userStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  userActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  userActionText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  // Banner styles
  addBannerCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  bannerCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  bannerPreview: {
    width: '100%',
    height: 120,
  },
  bannerInfo: {
    padding: 12,
  },
  bannerOrder: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  bannerLink: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  deleteBannerBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  // Payment method styles
  paymentCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  paymentDetails: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  paymentDetailText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  // Additional styles for new features
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF5000',
  },
  paymentLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  // Branding styles
  brandingCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  logoPreview: {
    width: 200,
    height: 60,
    marginVertical: 16,
  },
  logoPlaceholder: {
    width: 200,
    height: 80,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#DDD',
  },
  placeholderText: {
    color: '#999',
    marginTop: 8,
  },
  faviconPreview: {
    width: 64,
    height: 64,
    marginVertical: 16,
  },
  faviconPlaceholder: {
    width: 64,
    height: 64,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#DDD',
  },
  // Contact styles
  contactCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  addSocialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  socialPickerContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
  },
  socialPickerItem: {
    padding: 8,
    borderRadius: 8,
  },
  socialPickerItemActive: {
    backgroundColor: '#FFF3E0',
  },
  addSocialBtn: {
    backgroundColor: '#FF5000',
    borderRadius: 8,
    padding: 10,
  },
  socialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  socialUrl: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  noSocialText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 16,
  },
  // Add payment modal styles
  logoPickerBtn: {
    width: '100%',
    height: 80,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#DDD',
  },
  logoPickerText: {
    color: '#999',
    marginTop: 4,
  },
  newPaymentLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  removeFieldBtn: {
    padding: 4,
    marginLeft: 8,
  },
  addFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  addFieldText: {
    color: '#FF5000',
    marginLeft: 4,
    fontWeight: '600',
  },
});
