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

export default function Home() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [zinliAmount, setZinliAmount] = useState('');
  const [zinliEmail, setZinliEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calculateCost();
  }, [zinliAmount, config]);

  const loadData = async () => {
    try {
      const [bannersRes, configRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/banners`),
        axios.get(`${BACKEND_URL}/api/config`),
      ]);

      setBanners(bannersRes.data);
      setConfig(configRes.data);
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
    if (!zinliAmount || !config) {
      setTotalCost(0);
      return;
    }

    const amount = parseFloat(zinliAmount);
    if (isNaN(amount)) {
      setTotalCost(0);
      return;
    }

    const baseCost = amount * config.exchange_rate;
    const total = baseCost + (baseCost * config.commission_percent / 100);
    setTotalCost(total);
  };

  const handlePaymentSelect = (method: string) => {
    if (!zinliAmount || parseFloat(zinliAmount) <= 0) {
      Alert.alert('Error', 'Por favor ingresa la cantidad de recarga');
      return;
    }

    if (!zinliEmail.trim()) {
      Alert.alert('Error', 'Por favor ingresa el email o ID de Zinli del destinatario');
      return;
    }

    if (!confirmEmail) {
      Alert.alert('Error', 'Por favor confirma que el email de Zinli es correcto');
      return;
    }

    router.push({
      pathname: '/payment',
      params: {
        orderType: 'zinli_recharge',
        zinliAmount,
        zinliEmail,
        totalCost: totalCost.toFixed(2),
        paymentMethod: method,
      },
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
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5000" />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {user?.name}</Text>
          <Text style={styles.subGreeting}>Recarga tu Zinli ahora</Text>
        </View>
        {user?.is_admin && (
          <TouchableOpacity
            style={styles.adminButton}
            onPress={() => router.push('/admin')}
          >
            <Ionicons name="settings" size={24} color="#FF5000" />
          </TouchableOpacity>
        )}
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

      {/* Calculator */}
      <View style={styles.calculatorCard}>
        <Text style={styles.cardTitle}>Calculadora de Recarga Zinli</Text>
        
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
              value={zinliAmount}
              onChangeText={setZinliAmount}
              keyboardType="decimal-pad"
              placeholderTextColor="#CCC"
            />
          </View>
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Email o ID de Zinli del destinatario *</Text>
          <View style={styles.emailInputContainer}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.emailInput}
              placeholder="ejemplo@correo.com"
              value={zinliEmail}
              onChangeText={setZinliEmail}
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
            Confirmo que el email/ID de Zinli es correcto
          </Text>
        </TouchableOpacity>

        {totalCost > 0 && (
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total a pagar:</Text>
            <Text style={styles.totalAmount}>{totalCost.toFixed(2)} Bs</Text>
          </View>
        )}
      </View>

      {/* Payment Methods */}
      <View style={styles.paymentMethodsCard}>
        <Text style={styles.cardTitle}>Métodos de Pago</Text>
        
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

        {/* Tarjeta de Crédito (Ubii) - Solo si está activo */}
        {config?.ubii_config?.is_active && (
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
