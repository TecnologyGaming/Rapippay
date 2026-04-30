import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Image,
  Modal,
  Platform,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

interface Banner {
  id: string;
  image_base64: string;
  link?: string;
}

interface SystemConfig {
  exchange_rate: number;
  commission_percent: number;
  bank_details: any;
  ubii_config?: {
    client_id: string;
    client_domain: string;
    is_active: boolean;
  };
}

type ServiceType = 'zinli' | 'wally' | 'online' | 'shopper';

const SERVICE_OPTIONS = [
  { id: 'zinli', name: 'Recarga Zinli', icon: 'flash', color: '#FF5000' },
  { id: 'wally', name: 'Recarga Wally', icon: 'wallet', color: '#4CAF50' },
  { id: 'online', name: 'Recargas Online', icon: 'globe', color: '#2196F3' },
  { id: 'shopper', name: 'Personal Shopper', icon: 'cart', color: '#9C27B0' },
];

export default function Home() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [destinationEmail, setDestinationEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Service selection
  const [selectedService, setSelectedService] = useState<ServiceType>('zinli');
  const [showServicePicker, setShowServicePicker] = useState(false);
  
  // Personal Shopper
  const [shopperDescription, setShopperDescription] = useState('');
  
  // Notifications
  const [hasNotifications, setHasNotifications] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calculateCost();
  }, [amount, config, selectedService]);

  const loadData = async () => {
    try {
      const [bannersRes, configRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/banners`),
        axios.get(`${BACKEND_URL}/api/config`),
      ]);

      setBanners(bannersRes.data);
      setConfig(configRes.data);
      
      // Check for pending notifications (for demo, set to true if there are pending orders)
      if (token) {
        try {
          const ordersRes = await axios.get(`${BACKEND_URL}/api/orders`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const pendingOrders = ordersRes.data.filter((o: any) => o.status === 'completed' || o.status === 'rejected');
          setHasNotifications(pendingOrders.length > 0);
        } catch (e) {}
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const calculateCost = () => {
    if (!amount || !config || selectedService === 'shopper') {
      setTotalCost(0);
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum)) {
      setTotalCost(0);
      return;
    }

    const baseCost = amountNum * config.exchange_rate;
    const total = baseCost + (baseCost * config.commission_percent / 100);
    setTotalCost(total);
  };

  const handlePaymentSelect = (method: string) => {
    if (selectedService === 'shopper') {
      // Personal Shopper flow
      if (!shopperDescription.trim()) {
        if (Platform.OS === 'web') {
          alert('Por favor describe qué servicio necesitas');
        } else {
          Alert.alert('Error', 'Por favor describe qué servicio necesitas');
        }
        return;
      }
      
      router.push({
        pathname: '/payment',
        params: {
          orderType: 'personal_shopper',
          shopperDescription,
          totalCost: '0', // P2P - to be negotiated
          paymentMethod: method,
        },
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      if (Platform.OS === 'web') {
        alert('Por favor ingresa la cantidad de recarga');
      } else {
        Alert.alert('Error', 'Por favor ingresa la cantidad de recarga');
      }
      return;
    }

    if (!destinationEmail.trim()) {
      if (Platform.OS === 'web') {
        alert('Por favor ingresa el email o ID del destinatario');
      } else {
        Alert.alert('Error', 'Por favor ingresa el email o ID del destinatario');
      }
      return;
    }

    if (!confirmEmail) {
      if (Platform.OS === 'web') {
        alert('Por favor confirma que el email/ID es correcto');
      } else {
        Alert.alert('Error', 'Por favor confirma que el email/ID es correcto');
      }
      return;
    }

    const orderType = selectedService === 'zinli' ? 'zinli_recharge' : 
                      selectedService === 'wally' ? 'wally_recharge' : 'online_recharge';

    router.push({
      pathname: '/payment',
      params: {
        orderType,
        zinliAmount: amount,
        zinliEmail: destinationEmail,
        totalCost: totalCost.toFixed(2),
        paymentMethod: method,
      },
    });
  };

  const getServiceInfo = () => {
    return SERVICE_OPTIONS.find(s => s.id === selectedService) || SERVICE_OPTIONS[0];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF5000" />
      </View>
    );
  }

  const currentService = getServiceInfo();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5000" />
      }
    >
      {/* Header with Notification Bell */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Hola, {user?.first_name || user?.name || 'Usuario'}</Text>
          <Text style={styles.subGreeting}>¿Qué deseas hacer hoy?</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => router.push('/(tabs)/orders')}
          >
            <Ionicons name="notifications" size={24} color="#FF5000" />
            {hasNotifications && <View style={styles.notificationBadge} />}
          </TouchableOpacity>
          {user?.is_admin && (
            <TouchableOpacity
              style={styles.adminButton}
              onPress={() => router.push('/admin')}
            >
              <Ionicons name="settings" size={24} color="#FF5000" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Banners */}
      {banners.length > 0 && (
        <View style={styles.bannersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} pagingEnabled>
            {banners.map((banner) => (
              <View key={banner.id} style={styles.bannerItem}>
                <Image
                  source={{ uri: banner.image_base64 }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Service Selector */}
      <TouchableOpacity 
        style={styles.serviceSelectorButton}
        onPress={() => setShowServicePicker(true)}
      >
        <View style={[styles.serviceIcon, { backgroundColor: currentService.color + '20' }]}>
          <Ionicons name={currentService.icon as any} size={24} color={currentService.color} />
        </View>
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceLabel}>Servicio seleccionado</Text>
          <Text style={[styles.serviceName, { color: currentService.color }]}>{currentService.name}</Text>
        </View>
        <Ionicons name="chevron-down" size={24} color="#666" />
      </TouchableOpacity>

      {/* Service Picker Modal */}
      <Modal
        visible={showServicePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowServicePicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowServicePicker(false)}
        >
          <View style={styles.servicePickerModal}>
            <Text style={styles.servicePickerTitle}>Selecciona un servicio</Text>
            {SERVICE_OPTIONS.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={[
                  styles.serviceOption,
                  selectedService === service.id && styles.serviceOptionSelected
                ]}
                onPress={() => {
                  setSelectedService(service.id as ServiceType);
                  setShowServicePicker(false);
                }}
              >
                <View style={[styles.serviceOptionIcon, { backgroundColor: service.color + '20' }]}>
                  <Ionicons name={service.icon as any} size={24} color={service.color} />
                </View>
                <Text style={styles.serviceOptionText}>{service.name}</Text>
                {selectedService === service.id && (
                  <Ionicons name="checkmark-circle" size={24} color={service.color} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Calculator/Form Card */}
      <View style={styles.calculatorCard}>
        {selectedService === 'shopper' ? (
          // Personal Shopper Form
          <>
            <Text style={styles.cardTitle}>Personal Shopper</Text>
            <View style={styles.shopperInfo}>
              <Ionicons name="information-circle" size={20} color="#9C27B0" />
              <Text style={styles.shopperInfoText}>
                Describe qué necesitas y negociaremos el precio (P2P)
              </Text>
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>¿Qué servicio necesitas?</Text>
              <TextInput
                style={styles.shopperInput}
                placeholder="Ej: Pagar suscripción de Netflix, impuestos, compras online..."
                value={shopperDescription}
                onChangeText={setShopperDescription}
                multiline
                numberOfLines={4}
                placeholderTextColor="#CCC"
              />
            </View>
          </>
        ) : (
          // Regular Recharge Form
          <>
            <Text style={styles.cardTitle}>{currentService.name}</Text>
            
            {config && (
              <View style={styles.rateInfo}>
                <Text style={styles.rateText}>
                  Tasa: {config.exchange_rate.toFixed(2)} Bs/USD
                </Text>
                <Text style={styles.rateText}>
                  Comisión: {config.commission_percent}%
                </Text>
              </View>
            )}

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>¿Cuánto deseas recargar?</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#CCC"
                />
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Email o ID del destinatario *</Text>
              <View style={styles.emailInputContainer}>
                <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.emailInput}
                  placeholder="ejemplo@correo.com"
                  value={destinationEmail}
                  onChangeText={setDestinationEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#CCC"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setConfirmEmail(!confirmEmail)}
            >
              <View style={[styles.checkbox, confirmEmail && styles.checkboxChecked]}>
                {confirmEmail && <Ionicons name="checkmark" size={18} color="#FFF" />}
              </View>
              <Text style={styles.checkboxLabel}>
                Confirmo que el email/ID es correcto
              </Text>
            </TouchableOpacity>

            {totalCost > 0 && (
              <View style={[styles.totalContainer, { backgroundColor: currentService.color }]}>
                <Text style={styles.totalLabel}>Total a pagar:</Text>
                <Text style={styles.totalAmount}>{totalCost.toFixed(2)} Bs</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Payment Methods */}
      <View style={styles.paymentMethodsCard}>
        <Text style={styles.cardTitle}>
          {selectedService === 'shopper' ? 'Enviar Solicitud' : 'Métodos de Pago'}
        </Text>
        
        <TouchableOpacity
          style={styles.paymentButton}
          onPress={() => handlePaymentSelect('pago_movil')}
        >
          <Ionicons name="phone-portrait" size={24} color="#FF5000" />
          <Text style={styles.paymentButtonText}>Pago Móvil</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.paymentButton}
          onPress={() => handlePaymentSelect('transferencia')}
        >
          <Ionicons name="card" size={24} color="#FF5000" />
          <Text style={styles.paymentButtonText}>Transferencia Bancaria</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.paymentButton}
          onPress={() => handlePaymentSelect('binance_pay')}
        >
          <Ionicons name="logo-bitcoin" size={24} color="#FF5000" />
          <Text style={styles.paymentButtonText}>Binance Pay</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.paymentButton}
          onPress={() => handlePaymentSelect('paypal')}
        >
          <Ionicons name="logo-paypal" size={24} color="#FF5000" />
          <Text style={styles.paymentButtonText}>PayPal</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        {/* Tarjeta de Crédito (Ubii) - Solo si está activo y no es shopper */}
        {config?.ubii_config?.is_active && selectedService !== 'shopper' && (
          <TouchableOpacity
            style={[styles.paymentButton, { borderColor: '#6C5CE7', borderWidth: 2 }]}
            onPress={() => handlePaymentSelect('tarjeta_credito')}
          >
            <Ionicons name="card" size={24} color="#6C5CE7" />
            <Text style={[styles.paymentButtonText, { color: '#6C5CE7' }]}>Tarjeta de Crédito</Text>
            <Ionicons name="chevron-forward" size={20} color="#6C5CE7" />
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#FFF',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subGreeting: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  notificationButton: {
    padding: 8,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F44336',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  adminButton: {
    padding: 8,
  },
  bannersContainer: {
    height: 180,
    marginTop: 16,
  },
  bannerItem: {
    width: width - 48,
    height: 180,
    marginHorizontal: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  serviceSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    margin: 24,
    marginBottom: 0,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  serviceLabel: {
    fontSize: 12,
    color: '#666',
  },
  serviceName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  servicePickerModal: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  servicePickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  serviceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8F9FA',
  },
  serviceOptionSelected: {
    backgroundColor: '#FFF5F0',
    borderWidth: 2,
    borderColor: '#FF5000',
  },
  serviceOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  calculatorCard: {
    backgroundColor: '#FFF',
    margin: 24,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  shopperInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  shopperInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#9C27B0',
  },
  shopperInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  rateInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFF5F0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  rateText: {
    fontSize: 14,
    color: '#FF5000',
    fontWeight: '600',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 60,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF5000',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  emailInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  emailInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#DDD',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FF5000',
    borderColor: '#FF5000',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FF5000',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  paymentMethodsCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12,
  },
  paymentButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
});
