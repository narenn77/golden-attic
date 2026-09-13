import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { createOrder } from '../api/orders';
import { createCheckoutIntent } from '../api/payments';
import { ApiError } from '../api/client';

// Navigated to with { listingId, title, price } in route.params.
export default function CheckoutScreen({ route, navigation }: any) {
  const { listingId, title, price } = route.params;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [preparing, setPreparing] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const prepare = useCallback(async () => {
    setPreparing(true);
    setError(null);
    try {
      // 1. Open an order against this listing.
      const order = await createOrder({ listingId, amount: Number(price) });
      setOrderId(order.id);

      // 2. Ask the backend for a PaymentIntent client secret (destination
      // charge - seller gets paid minus the platform commission automatically).
      const { clientSecret } = await createCheckoutIntent(order.id);

      // 3. Hand the client secret to Stripe's native payment sheet.
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Golden Attic',
        paymentIntentClientSecret: clientSecret,
      });

      if (initError) {
        setError(initError.message);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start checkout. Please try again.');
    } finally {
      setPreparing(false);
    }
  }, [listingId, price]);

  useEffect(() => {
    prepare();
  }, [prepare]);

  async function handlePay() {
    setPaying(true);
    const { error: presentError } = await presentPaymentSheet();
    setPaying(false);

    if (presentError) {
      if (presentError.code !== 'Canceled') {
        Alert.alert('Payment failed', presentError.message);
      }
      return;
    }

    Alert.alert('Payment successful', 'Thanks for your purchase!', [
      { text: 'OK', onPress: () => navigation.navigate('Browse') },
    ]);
  }

  if (preparing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B8860B" />
        <Text style={styles.preparingText}>Preparing checkout...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={prepare}>
          <Text style={styles.retryButtonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>You're buying</Text>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemPrice}>${Number(price).toFixed(2)}</Text>
      </View>

      <TouchableOpacity style={styles.payButton} onPress={handlePay} disabled={paying || !orderId}>
        {paying ? <ActivityIndicator color="#fff" /> : <Text style={styles.payButtonText}>Pay Now</Text>}
      </TouchableOpacity>

      <Text style={styles.footnote}>Payments are securely processed by Stripe.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  preparingText: { marginTop: 12, color: '#666' },
  errorText: { color: '#D32F2F', textAlign: 'center', marginBottom: 16, fontSize: 15 },
  retryButton: { backgroundColor: '#B8860B', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  summary: { backgroundColor: '#FAF6EC', borderRadius: 12, padding: 20, marginBottom: 24 },
  summaryLabel: { fontSize: 13, color: '#8B6914', marginBottom: 4 },
  itemTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  itemPrice: { fontSize: 26, fontWeight: '700', color: '#B8860B' },
  payButton: { backgroundColor: '#B8860B', borderRadius: 8, padding: 16, alignItems: 'center' },
  payButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footnote: { textAlign: 'center', color: '#999', fontSize: 12, marginTop: 16 },
});
