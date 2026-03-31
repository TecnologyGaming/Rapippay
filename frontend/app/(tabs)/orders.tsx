import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Dimensions,
  Linking,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

interface Order {
  id: string;
  zinli_amount: number;
  total_cost: number;
  payment_method: string;
  status: string;
  created_at: string;
}

interface Banner {
  id: string;
  image_base64: string;
  link?: string;
}

export default function Orders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  // Auto-rotate banners every 5 seconds
  useEffect(() => {
    if (banners.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [banners.length]);

  useEffect(() => {
    loadOrders();
    loadBanners();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(response.data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBanners = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/banners`);
      setBanners(response.data);
    } catch (error) {
      console.error('Error loading banners:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadOrders(), loadBanners()]);
    setRefreshing(false);
  };

  const handleBannerPress = (link?: string) => {
    if (link) {
      Linking.openURL(link);
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

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'pago_movil':
        return 'Pago Móvil';
      case 'transferencia':
        return 'Transferencia';
      case 'binance_pay':
        return 'Binance Pay';
      case 'paypal':
        return 'PayPal';
      default:
        return method;
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
        <Text style={styles.headerTitle}>Mis Pedidos</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5000" />
        }
      >
        {/* Advertising Banner - Auto Rotating */}
        {banners.length > 0 && (
          <View style={styles.adBannerContainer}>
            <TouchableOpacity 
              style={styles.adBanner} 
              onPress={() => handleBannerPress(banners[currentBannerIndex]?.link)}
              activeOpacity={0.9}
            >
              <Image 
                source={{ uri: banners[currentBannerIndex]?.image_base64 }} 
                style={styles.adBannerImage}
                resizeMode="cover"
              />
              <View style={styles.adBadge}>
                <Text style={styles.adBadgeText}>Publicidad</Text>
              </View>
            </TouchableOpacity>
            
            {/* Dots indicator */}
            {banners.length > 1 && (
              <View style={styles.dotsContainer}>
                {banners.map((_, index) => (
                  <TouchableOpacity 
                    key={index} 
                    onPress={() => setCurrentBannerIndex(index)}
                    style={[
                      styles.dot,
                      currentBannerIndex === index && styles.dotActive
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No tienes pedidos aún</Text>
            <Text style={styles.emptySubtext}>Tus recargas aparecerán aquí</Text>
          </View>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={styles.orderHeaderLeft}>
                  <Text style={styles.orderAmount}>${order.zinli_amount.toFixed(2)}</Text>
                  <Text style={styles.orderCost}>{order.total_cost.toFixed(2)} Bs</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                  <Text style={styles.statusText}>{getStatusText(order.status)}</Text>
                </View>
              </View>

              <View style={styles.orderDetails}>
                <View style={styles.orderDetailRow}>
                  <Ionicons name="card-outline" size={16} color="#666" />
                  <Text style={styles.orderDetailText}>
                    {getPaymentMethodText(order.payment_method)}
                  </Text>
                </View>

                <View style={styles.orderDetailRow}>
                  <Ionicons name="time-outline" size={16} color="#666" />
                  <Text style={styles.orderDetailText}>{formatDate(order.created_at)}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
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
  },
  orderHeaderLeft: {
    flex: 1,
  },
  orderAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  orderCost: {
    fontSize: 16,
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
  orderDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 16,
  },
  orderDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderDetailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  // Ad Banner styles
  adBannerContainer: {
    marginBottom: 20,
  },
  adBanner: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    position: 'relative',
  },
  adBannerImage: {
    width: '100%',
    height: '100%',
  },
  adBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  adBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DDD',
  },
  dotActive: {
    backgroundColor: '#FF5000',
    width: 20,
  },
});