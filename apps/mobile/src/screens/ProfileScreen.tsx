import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import * as authApi from '../api/auth';
import { ApiError } from '../api/client';
import { useNotificationCounts } from '../hooks/useNotificationCounts';

function NavBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

export default function ProfileScreen({ navigation }: any) {
  const { user, refreshUser } = useAuth();
  const { unreadMessages, bidActivity } = useNotificationCounts();
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');

  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressSaved, setAddressSaved] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setAddressLine1(user.addressLine1 || '');
      setAddressLine2(user.addressLine2 || '');
      setCity(user.city || '');
      setState(user.state || '');
      setPostalCode(user.postalCode || '');
    }
  }, [user]);

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

  async function handleSaveAddress() {
    setSavingAddress(true);
    setAddressError(null);
    setAddressSaved(false);
    try {
      await authApi.updateAddress({ addressLine1, addressLine2, city, state, postalCode, country: 'US' });
      await refreshUser();
      setAddressSaved(true);
    } catch (err: any) {
      setAddressError(err?.message || 'Could not save your address.');
    } finally {
      setSavingAddress(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
        <TouchableOpacity style={[styles.payoutButton, styles.payoutButtonRow]} onPress={() => navigation.navigate('MyListings')}>
          <Text style={styles.payoutButtonText}>My Listings</Text>
          <NavBadge count={bidActivity} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.payoutButton, styles.payoutButtonRow]} onPress={() => navigation.navigate('Messages')}>
          <Text style={styles.payoutButtonText}>Messages</Text>
          <NavBadge count={unreadMessages} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.payoutButton} onPress={() => navigation.navigate('Orders')}>
          <Text style={styles.payoutButtonText}>My Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.payoutButton} onPress={() => navigation.navigate('SellerOnboarding')}>
          <Text style={styles.payoutButtonText}>
            {user?.isSeller ? 'Manage payout settings' : 'Set up payouts'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Shipping address</Text>
        <Text style={styles.sectionBody}>Used as your default ship-to address when buying, and ship-from location when selling.</Text>
        <TextInput style={styles.input} placeholder="Address line 1" value={addressLine1} onChangeText={setAddressLine1} />
        <TextInput style={styles.input} placeholder="Address line 2 (optional)" value={addressLine2} onChangeText={setAddressLine2} />
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.rowInputCity]} placeholder="City" value={city} onChangeText={setCity} />
          <TextInput style={[styles.input, styles.rowInputSmall]} placeholder="State" value={state} onChangeText={setState} />
          <TextInput style={[styles.input, styles.rowInputSmall]} placeholder="ZIP" value={postalCode} onChangeText={setPostalCode} keyboardType="number-pad" />
        </View>
        {addressError && <Text style={styles.resendErrorText}>{addressError}</Text>}
        {addressSaved && <Text style={styles.resendSentText}>Address saved.</Text>}
        <TouchableOpacity style={styles.saveAddressButton} onPress={handleSaveAddress} disabled={savingAddress}>
          {savingAddress ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveAddressButtonText}>Save address</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingBottom: 48 },
  name: { fontSize: 22, fontWeight: '700' },
  email: { fontSize: 14, color: '#666', marginBottom: 20 },
  warningBanner: { backgroundColor: '#FFF3E0', padding: 12, borderRadius: 8, marginBottom: 20 },
  warningText: { color: '#8B4513', textAlign: 'center', marginBottom: 8 },
  resendLink: { color: '#8B4513', textAlign: 'center', fontWeight: '600', textDecorationLine: 'underline' },
  resendSentText: { color: '#2E7D32', textAlign: 'center', fontWeight: '600', marginTop: 4 },
  resendErrorText: { color: '#D32F2F', textAlign: 'center', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  sectionBody: { fontSize: 14, color: '#666', marginBottom: 8 },
  payoutButton: { borderWidth: 1, borderColor: '#B8860B', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 12 },
  payoutButtonRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  payoutButtonText: { color: '#B8860B', fontWeight: '600' },
  badge: { backgroundColor: '#B8860B', borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 14 },
  row: { flexDirection: 'row', gap: 8 },
  rowInputCity: { flex: 2 },
  rowInputSmall: { flex: 1 },
  saveAddressButton: { backgroundColor: '#B8860B', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 4 },
  saveAddressButtonText: { color: '#fff', fontWeight: '600' },
});
