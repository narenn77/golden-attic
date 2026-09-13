import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{user?.name}</Text>
      <Text style={styles.email}>{user?.email}</Text>

      {!user?.emailVerified && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>Please verify your email address.</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Selling</Text>
        <Text style={styles.sectionBody}>
          {user?.isSeller
            ? 'You can list items for sale.'
            : 'Create your first listing to become a seller.'}
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  name: { fontSize: 22, fontWeight: '700' },
  email: { fontSize: 14, color: '#666', marginBottom: 20 },
  warningBanner: { backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, marginBottom: 20 },
  warningText: { color: '#8B4513', textAlign: 'center' },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  sectionBody: { fontSize: 14, color: '#666' },
  logoutButton: { borderWidth: 1, borderColor: '#D32F2F', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 'auto' },
  logoutButtonText: { color: '#D32F2F', fontWeight: '600' },
});
