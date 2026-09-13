import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, AppState } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { startSellerOnboarding, getSellerOnboardingStatus } from '../api/payments';
import { becomeSeller } from '../api/auth';
import { useAuth } from '../context/AuthContext';

type Status = { onboarded: boolean; chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted?: boolean };

export default function SellerOnboardingScreen() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const result = await getSellerOnboardingStatus();
      setStatus(result);

      // If Stripe now says the account can take charges and receive payouts,
      // but our own isSeller flag hasn't caught up yet, flip it now.
      if (result.chargesEnabled && result.payoutsEnabled && user && !user.isSeller) {
        await becomeSeller(user.id);
        await refreshUser();
      }
    } catch {
      // No connected account yet is a normal, expected state - not an error to surface.
      setStatus({ onboarded: false, chargesEnabled: false, payoutsEnabled: false });
    } finally {
      setLoading(false);
    }
  }, [user, refreshUser]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Re-check status whenever the app comes back to the foreground - this is
  // how we notice the seller finished the hosted Stripe onboarding flow.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        loadStatus();
      }
    });
    return () => subscription.remove();
  }, [loadStatus]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const { url } = await startSellerOnboarding();
      await WebBrowser.openBrowserAsync(url);
      // The status refresh above (triggered on returning to foreground)
      // picks up the result once the user comes back from Stripe's flow.
    } catch (err: any) {
      Alert.alert('Could not start setup', err?.message || 'Please try again.');
    } finally {
      setConnecting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B8860B" />
      </View>
    );
  }

  const fullyOnboarded = status?.chargesEnabled && status?.payoutsEnabled;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Get paid for your sales</Text>
      <Text style={styles.body}>
        Golden Attic uses Stripe to securely send you money when your items sell. It takes about 5 minutes to set up
        and only needs to be done once.
      </Text>

      {fullyOnboarded ? (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>✓ You're all set up to receive payouts.</Text>
        </View>
      ) : (
        <>
          {status?.onboarded && !fullyOnboarded && (
            <View style={styles.pendingBanner}>
              <Text style={styles.pendingText}>
                You've started setup but there are still a few details Stripe needs. Tap below to finish.
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.connectButton} onPress={handleConnect} disabled={connecting}>
            {connecting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.connectButtonText}>
                {status?.onboarded ? 'Finish setup with Stripe' : 'Set up payouts with Stripe'}
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  body: { fontSize: 15, color: '#666', lineHeight: 22, marginBottom: 24 },
  successBanner: { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 16 },
  successText: { color: '#2E7D32', fontWeight: '600', textAlign: 'center' },
  pendingBanner: { backgroundColor: '#FFF3E0', borderRadius: 10, padding: 16, marginBottom: 16 },
  pendingText: { color: '#8B6914', fontSize: 14, lineHeight: 20 },
  connectButton: { backgroundColor: '#635BFF', borderRadius: 8, padding: 16, alignItems: 'center' },
  connectButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
