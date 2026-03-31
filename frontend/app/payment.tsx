import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Payment() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { token } = useAuth();
  const [referenceNumber, setReferenceNumber] = useState('');
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bankDetails, setBankDetails] = useState<any>(null);

  const zinliAmount = params.zinliAmount as string;
  const totalCost = params.totalCost as string;
  const paymentMethod = params.paymentMethod as string;

  useEffect(() => {
    loadBankDetails();
  }, []);

  const loadBankDetails = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/config`);
      const config = response.data;
      setBankDetails(config.bank_details[paymentMethod]);
    } catch (error) {
      console.error('Error loading bank details:', error);
    }
  };

  // Handle file input change for web
  const handleFileChange = (event: any) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setProofImage(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const pickImage = async () => {
    // For web, use native file input with document.getElementById
    if (Platform.OS === 'web') {
      const fileInput = document.getElementById('proof-image-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.click();
      }
      return;
    }

    // For native platforms
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos necesarios', 'Necesitamos acceso a tu galería para subir el comprobante de pago.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setProofImage(base64Image);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const handleSubmit = async () => {
    if (!referenceNumber) {
      Alert.alert('Error', 'Por favor ingresa el número de referencia');
      return;
    }

    if (!proofImage) {
      Alert.alert('Error', 'Por favor sube el comprobante de pago');
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/orders`,
        {
          zinli_amount: parseFloat(zinliAmount),
          payment_method: paymentMethod,
          reference_number: referenceNumber,
          payment_proof_image: proofImage,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert(
        'Éxito',
        'Tu pedido ha sido enviado. Lo procesaremos pronto.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/orders'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo crear el pedido');
    } finally {
      setLoading(false);
    }
  };

  const getPaymentMethodTitle = () => {
    switch (paymentMethod) {
      case 'pago_movil':
        return 'Pago Móvil';
      case 'transferencia':
        return 'Transferencia Bancaria';
      case 'binance_pay':
        return 'Binance Pay';
      case 'paypal':
        return 'PayPal';
      default:
        return paymentMethod;
    }
  };

  const renderBankDetails = () => {
    if (!bankDetails) return null;

    switch (paymentMethod) {
      case 'pago_movil':
        return (
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Banco:</Text>
              <Text style={styles.detailValue}>{bankDetails.bank}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Teléfono:</Text>
              <Text style={styles.detailValue}>{bankDetails.phone}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cédula:</Text>
              <Text style={styles.detailValue}>{bankDetails.id}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Titular:</Text>
              <Text style={styles.detailValue}>{bankDetails.name}</Text>
            </View>
          </View>
        );

      case 'transferencia':
        return (
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Banco:</Text>
              <Text style={styles.detailValue}>{bankDetails.bank}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tipo:</Text>
              <Text style={styles.detailValue}>{bankDetails.account_type}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cuenta:</Text>
              <Text style={styles.detailValue}>{bankDetails.account_number}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>RIF:</Text>
              <Text style={styles.detailValue}>{bankDetails.id}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Titular:</Text>
              <Text style={styles.detailValue}>{bankDetails.name}</Text>
            </View>
          </View>
        );

      case 'binance_pay':
        return (
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email:</Text>
              <Text style={styles.detailValue}>{bankDetails.email}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>User ID:</Text>
              <Text style={styles.detailValue}>{bankDetails.user_id}</Text>
            </View>
          </View>
        );

      case 'paypal':
        return (
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email:</Text>
              <Text style={styles.detailValue}>{bankDetails.email}</Text>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Realizar Pago</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryCardTitle}>Resumen del Pedido</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Monto en Zinli:</Text>
            <Text style={styles.summaryValue}>${zinliAmount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total a pagar:</Text>
            <Text style={styles.summaryValueBold}>{totalCost} Bs</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Método:</Text>
            <Text style={styles.summaryValue}>{getPaymentMethodTitle()}</Text>
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Datos para el Pago</Text>
          {renderBankDetails()}
        </View>

        {/* Upload Proof */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Comprobante de Pago</Text>

          {/* Hidden file input for web */}
          {Platform.OS === 'web' && (
            <input
              id="proof-image-input"
              type="file"
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
          )}

          <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
            <Ionicons name="cloud-upload" size={32} color="#FF5000" />
            <Text style={styles.uploadButtonText}>
              {proofImage ? 'Cambiar imagen' : 'Subir comprobante'}
            </Text>
          </TouchableOpacity>

          {proofImage && (
            <Image source={{ uri: proofImage }} style={styles.previewImage} />
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Número de Referencia</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 123456789"
              value={referenceNumber}
              onChangeText={setReferenceNumber}
              placeholderTextColor="#999"
            />
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#FFF" />
              <Text style={styles.submitButtonText}>Enviar Pedido</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  scrollContent: {
    padding: 24,
  },
  summaryCard: {
    backgroundColor: '#FF5000',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  summaryCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16,
  },
  card: {
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
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  summaryValueBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  detailsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  uploadButton: {
    backgroundColor: '#FFF5F0',
    borderWidth: 2,
    borderColor: '#FF5000',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF5000',
    marginTop: 8,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
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
  },
  submitButton: {
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
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 8,
  },
});