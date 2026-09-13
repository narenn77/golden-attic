import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import * as authApi from '../api/auth';
import { ApiError } from '../api/client';

export default function ProfileScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');

  async function handleResend() {
    setResendState('sending');
    try {
      const result = await authApi.resendVerification();
      setResendMessage(result.message);
      setResendState('sent');
    } catch (err) {
      setResendMessage(err instanceof ApiError ? err.message : 'Could not resend verification email.');
      setResendState('error');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{user?.name}</Text>
      <Text style={styles.email}>{user?.email}</Text>

      {!user?.emailVerified && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>Please verify your email address.</Text>
          {resendState === 'sent' ? (
            <Text style={styles.resendSentText}>{resendMessage}</Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resendState === 'sending'}>
              {resendState === 'sending' ? (
                <ActivityIndicator color="#8B4513" style={{ marginTop: 8 }} />
              ) : (
                <Text style={styles.resendLink}>Resend verification email</Text>
              )}
            </TouchableOpacity>
          )}
          {resendState === 'error' && <Text style={styles.resendErrorText}>{resendMessage}</Text>}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Selling</Text>
        <Text style={styles.sectionBody}>
          {user?.isSeller
            ? 'You can list items for sale.'
            : 'Set up payouts to start selling your items.'}
        </Text>
        <TouchableOpacity style={styles.payoutButton} onPress={() => navigation.navigate('MyListings')}>
          <Text style={styles.payoutButtonText}>My Listings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.payoutButton} onPress={() => navigation.navigate('SellerOnboarding')}>
          <Text style={styles.payoutButtonText}>
            {user?.isSeller ? 'Manage payout settings' : 'Set up payouts'}
          </Text>
        </TouchableOpacity>
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
  warningText: { color: '#8B4513', textAlign: 'center', marginBottom: 8 },
  resendLink: { color: '#8B4513', textAlign: 'center', fontWeight: '600', textDecorationLine: 'underline' },
  resendSentText: { color: '#8B4513', textAlign: 'center', fontWeight: '600' },
  resendErrorText: { color: '#D32F2F', textAlign: 'center', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  sectionBody: { fontSize: 14, color: '#666' },
  payoutButton: { borderWidth: 1, borderColor: '#B8860B', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 12 },
  payoutButtonText: { color: '#B8860B', fontWeight: '600' },
  logoutButton: { borderWidth: 1, borderColor: '#D32F2F', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 'auto' },
  logoutButtonText: { color: '#D32F2F', fontWeight: '600' },
});
