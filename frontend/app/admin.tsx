import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Admin() {
  const router = useRouter();

  useEffect(() => {
    checkAdminSession();
  }, []);

  const checkAdminSession = async () => {
    try {
      const session = await AsyncStorage.getItem('admin_session');
      if (session === 'true') {
        router.replace('/admin-panel');
      } else {
        router.replace('/admin-login');
      }
    } catch (error) {
      router.replace('/admin-login');
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FF5000" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
});
