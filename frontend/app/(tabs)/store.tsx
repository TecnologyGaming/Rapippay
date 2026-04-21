import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 72) / 2; // 24px padding on sides + 24px gap

interface GiftCard {
  id: string;
  name: string;
  description: string;
  image_base64: string | null;
  amounts: number[];
  is_active: boolean;
}

export default function Store() {
  const router = useRouter();
  const [featuredCards, setFeaturedCards] = useState<GiftCard[]>([]);
  const [allCards, setAllCards] = useState<GiftCard[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadGiftCards();
  }, []);

  const loadGiftCards = async () => {
    try {
      const [featuredRes, allRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/gift-cards/featured`),
        axios.get(`${BACKEND_URL}/api/gift-cards`),
      ]);

      setFeaturedCards(featuredRes.data);
      setAllCards(allRes.data);
    } catch (error) {
      console.error('Error loading gift cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGiftCards();
    setRefreshing(false);
  };

  const handleCardPress = (card: GiftCard) => {
    router.push({
      pathname: '/gift-card-detail',
      params: {
        id: card.id,
        name: card.name,
        description: card.description,
        image: card.image_base64 || '',
        amounts: JSON.stringify(card.amounts || []),
      },
    });
  };

  const renderCard = ({ item }: { item: GiftCard }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleCardPress(item)}
    >
      <View style={styles.cardImageContainer}>
        {item.image_base64 ? (
          <Image
            source={{ uri: item.image_base64 }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="gift" size={40} color="#CCC" />
          </View>
        )}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardCategory} numberOfLines={1}>{item.description}</Text>
        <View style={styles.priceRange}>
          <Text style={styles.priceText}>
            ${Math.min(...(item.amounts || [0]))} - ${Math.max(...(item.amounts || [0]))}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

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
        <Text style={styles.headerTitle}>Tienda de Gift Cards</Text>
        <Text style={styles.headerSubtitle}>Compra tarjetas de regalo digitales</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5000" />
        }
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="star" size={20} color="#FF5000" />
            <Text style={styles.sectionTitle}>Destacados</Text>
          </View>

          <View style={styles.grid}>
            {(showAll ? allCards : featuredCards).map((card) => (
              <View key={card.id} style={styles.cardWrapper}>
                {renderCard({ item: card })}
              </View>
            ))}
          </View>

          {!showAll && allCards.length > featuredCards.length && (
            <TouchableOpacity
              style={styles.viewMoreButton}
              onPress={() => setShowAll(true)}
            >
              <Text style={styles.viewMoreText}>Ver más productos</Text>
              <Ionicons name="chevron-down" size={20} color="#FF5000" />
            </TouchableOpacity>
          )}

          {showAll && (
            <TouchableOpacity
              style={styles.viewMoreButton}
              onPress={() => setShowAll(false)}
            >
              <Text style={styles.viewMoreText}>Ver menos</Text>
              <Ionicons name="chevron-up" size={20} color="#FF5000" />
            </TouchableOpacity>
          )}
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
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    padding: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  cardWrapper: {
    width: '50%',
    padding: 8,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImageContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#F8F9FA',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardContent: {
    padding: 12,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  cardCategory: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  priceRange: {
    backgroundColor: '#FFF5F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  priceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF5000',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#FF5000',
  },
  viewMoreText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF5000',
    marginRight: 8,
  },
});
