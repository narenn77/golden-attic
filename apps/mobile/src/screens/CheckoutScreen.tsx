import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { createOrder, fetchShippingQuote, type ShippingQuote } from '../api/orders';
import { createCheckoutIntent } from '../api/payments';
import { ApiError } from '../api/client';

// Navigated to with { listingId, title, price, bidId? } in route.params.
export default function CheckoutScreen({ route, navigation }: any) {
  const { listingId, title, price, bidId } = route.params;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [sheetReady, setSheetReady] = useState(false);

  // Shipping-choice phase
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [localPickup, setLocalPickup] = useState(false);
  const [shippingCost, setShippingCost] = useState(0);

  const loadQuote = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = await fetchShippingQuote(listingId);
      setQuote(q);
      setLocalPickup(q.localPickupEligible);
    } catch (err: any) {
      setError(err?.message || 'Could not load shipping options.');
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  async function handleConfirmShipping() {
    setConfirming(true);
    setError(null);
    try {
      const order = await createOrder({ listingId, localPickup, bidId });
      setOrderId(order.id);
      setShippingCost(Number(order.shippingCost ?? 0));

      const { clientSecret } = await createCheckoutIntent(order.id);

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Golden Attic',
        paymentIntentClientSecret: clientSecret,
      });

      if (initError) {
        setError(initError.message);
      } else {
        setSheetReady(true);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start checkout. Please try again.');
    } finally {
      setConfirming(false);
    }
  }

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B8860B" />
        <Text style={styles.preparingText}>Loading shipping options...</Text>
      </View>
    );
  }

  if (error && !sheetReady) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadQuote}>
          <Text style={styles.retryButtonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const itemPrice = Number(price);
  const shipCost = quote?.shippingCost ?? 0;
  const total = sheetReady ? itemPrice + shippingCost : localPickup ? itemPrice : itemPrice + shipCost;

  // Phase 1: shipping choice
  if (!sheetReady) {
    return (
      <View style={styles.container}>
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>You&apos;re buying</Text>
          <Text style={styles.itemTitle}>{title}</Text>
          <Text style={styles.itemPrice}>${itemPrice.toFixed(2)}</Text>
        </View>

        <Text style={styles.sectionLabel}>Delivery</Text>

        {quote?.localPickupEligible && (
          <TouchableOpacity style={styles.option} onPress={() => setLocalPickup(true)}>
            <View style={[styles.radio, localPickup && styles.radioSelected]} />
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Local pickup</Text>
              <Text style={styles.optionSubtitle}>
                Seller is near you (around {quote.sellerCity}, {quote.sellerState}). Free - message to arrange.
              </Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.option} onPress={() => setLocalPickup(false)}>
          <View style={[styles.radio, !localPickup && styles.radioSelected]} />
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>Ship to my address</Text>
            <Text style={styles.optionSubtitle}>
              {quote ? `${quote.service} — est. $${quote.shippingCost.toFixed(2)}` : 'Calculating...'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Item</Text>
            <Text style={styles.totalsValue}>${itemPrice.toFixed(2)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Shipping</Text>
            <Text style={styles.totalsValue}>{localPickup ? 'Free (pickup)' : `$${shipCost.toFixed(2)}`}</Text>
          </View>
          <View style={[styles.totalsRow, styles.totalsRowFinal]}>
            <Text style={styles.totalsLabelFinal}>Total</Text>
            <Text style={styles.totalsValueFinal}>${total.toFixed(2)}</Text>
          </View>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity style={styles.payButton} onPress={handleConfirmShipping} disabled={confirming}>
          {confirming ? <ActivityIndicator color="#fff" /> : <Text style={styles.payButtonText}>Continue to payment</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  // Phase 2: payment
  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>You&apos;re buying</Text>
        <Text style={styles.itemTitle}>{title}</Text>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Item</Text>
          <Text style={styles.totalsValue}>${itemPrice.toFixed(2)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Shipping</Text>
          <Text style={styles.totalsValue}>{shippingCost > 0 ? `$${shippingCost.toFixed(2)}` : 'Free (pickup)'}</Text>
        </View>
        <Text style={styles.itemPrice}>${total.toFixed(2)}</Text>
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
  summary: { backgroundColor: '#FAF6EC', borderRadius: 12, padding: 20, marginBottom: 20 },
  summaryLabel: { fontSize: 13, color: '#8B6914', marginBottom: 4 },
  itemTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  itemPrice: { fontSize: 26, fontWeight: '700', color: '#B8860B', marginTop: 8 },
  sectionLabel: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
  option: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, marginBottom: 8 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#ccc', marginRight: 10, marginTop: 2 },
  radioSelected: { borderColor: '#B8860B', backgroundColor: '#B8860B' },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 14, fontWeight: '600' },
  optionSubtitle: { fontSize: 12, color: '#888', marginTop: 2 },
  totalsBox: { marginTop: 12, marginBottom: 16 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalsRowFinal: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8, marginTop: 4 },
  totalsLabel: { fontSize: 13, color: '#666' },
  totalsValue: { fontSize: 13, color: '#666' },
  totalsLabelFinal: { fontSize: 16, fontWeight: '700' },
  totalsValueFinal: { fontSize: 16, fontWeight: '700' },
  payButton: { backgroundColor: '#B8860B', borderRadius: 8, padding: 16, alignItems: 'center' },
  payButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footnote: { textAlign: 'center', color: '#999', fontSize: 12, marginTop: 16 },
});
