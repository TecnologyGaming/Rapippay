import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function Support() {
  const handleEmailPress = () => {
    Linking.openURL('mailto:soporte@zinli-recargas.com');
  };

  const handleWhatsAppPress = () => {
    Linking.openURL('https://wa.me/584141234567');
  };

  const handleTelegramPress = () => {
    Linking.openURL('https://t.me/zinlirecargas');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Soporte</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>¿Necesitas ayuda?</Text>
          <Text style={styles.cardText}>
            Nuestro equipo está disponible para ayudarte con cualquier duda o problema que tengas.
          </Text>
        </View>

        <View style={styles.contactCard}>
          <Text style={styles.sectionTitle}>Contáctanos</Text>

          <TouchableOpacity style={styles.contactButton} onPress={handleEmailPress}>
            <View style={styles.contactIcon}>
              <Ionicons name="mail" size={24} color="#FF5000" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Correo Electrónico</Text>
              <Text style={styles.contactDetail}>soporte@zinli-recargas.com</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactButton} onPress={handleWhatsAppPress}>
            <View style={styles.contactIcon}>
              <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>WhatsApp</Text>
              <Text style={styles.contactDetail}>+58 414-1234567</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactButton} onPress={handleTelegramPress}>
            <View style={styles.contactIcon}>
              <Ionicons name="paper-plane" size={24} color="#0088cc" />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Telegram</Text>
              <Text style={styles.contactDetail}>@zinlirecargas</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.faqCard}>
          <Text style={styles.sectionTitle}>Preguntas Frecuentes</Text>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>¿Cuánto tiempo tarda la recarga?</Text>
            <Text style={styles.faqAnswer}>
              Las recargas son procesadas en un máximo de 2 horas después de verificar el pago.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>¿Qué métodos de pago aceptan?</Text>
            <Text style={styles.faqAnswer}>
              Aceptamos Pago Móvil, Transferencia Bancaria, Binance Pay y PayPal.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>¿Puedo cancelar una recarga?</Text>
            <Text style={styles.faqAnswer}>
              Sí, puedes cancelar mientras el pedido esté en estado "Pendiente". Contáctanos por cualquier canal.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>¿Es seguro?</Text>
            <Text style={styles.faqAnswer}>
              Sí, utilizamos encriptación de datos y procesamos todas las transacciones de forma segura.
            </Text>
          </View>
        </View>

        <View style={styles.hoursCard}>
          <Ionicons name="time" size={32} color="#FF5000" />
          <Text style={styles.hoursTitle}>Horario de Atención</Text>
          <Text style={styles.hoursText}>Lunes a Viernes: 8:00 AM - 8:00 PM</Text>
          <Text style={styles.hoursText}>Sábados: 9:00 AM - 5:00 PM</Text>
          <Text style={styles.hoursText}>Domingos: Cerrado</Text>
        </View>
      </ScrollView>
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
    padding: 24,
  },
  card: {
    backgroundColor: '#FFF5F0',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF5000',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  contactCard: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  contactDetail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  faqCard: {
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
  faqItem: {
    marginBottom: 24,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  hoursCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  hoursTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 16,
  },
  hoursText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
});