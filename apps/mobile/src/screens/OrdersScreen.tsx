import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput, Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { fetchMyOrders, completeOrder, type Order } from '../api/orders';
import { rateOrder, fetchRatingEligibility, type RatingEligibility } from '../api/ratings';
import RatingStars from '../components/RatingStars';

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting payment', PAID: 'Paid', SHIPPED: 'Shipped',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled', REFUNDED: 'Refunded',
};

function OrderCard({ order, currentUserId, onUpdated, navigation }: { order: Order; currentUserId: string; onUpdated: () => void; navigation: any }) {
  const isBuyer = order.buyerId === currentUserId;
  const otherParty = isBuyer ? order.seller : order.buyer;

  const [completing, setCompleting] = useState(false);
  const [eligibility, setEligibility] = useState<RatingEligibility | null>(null);
  const [showRateForm, setShowRateForm] = useState(false);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (order.status === 'COMPLETED') {
      fetchRatingEligibility(order.id).then(setEligibility).catch(() => {});
    }
  }, [order.id, order.status]);

  async function handleComplete() {
    setCompleting(true);
    try {
      await completeOrder(order.id);
      onUpdated();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not confirm receipt.');
    } finally {
      setCompleting(false);
    }
  }

  async function handleSubmitRating() {
    setSubmitting(true);
    try {
      await rateOrder(order.id, score, comment.trim() || undefined);
      setShowRateForm(false);
      setEligibility({ eligible: false, alreadyRated: true, orderStatus: order.status });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not submit rating.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('ListingDetail', { id: order.listingId })}>
        {order.listing?.images[0] ? (
          <Image source={{ uri: order.listing.images[0] }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbPlaceholderText}>No photo</Text>
          </View>
        )}
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{order.listing?.title || 'Item'}</Text>
            <Text style={styles.status}>{STATUS_LABELS[order.status]}</Text>
          </View>
          <Text style={styles.subtitle}>
            {isBuyer ? 'Bought from' : 'Sold to'} {otherParty?.name} · ${Number(order.amount).toFixed(2)}
          </Text>
        </View>
      </TouchableOpacity>

      {isBuyer && order.status === 'PAID' && (
        <TouchableOpacity style={styles.completeButton} onPress={handleComplete} disabled={completing}>
          {completing ? <ActivityIndicator color="#fff" /> : <Text style={styles.completeButtonText}>Confirm receipt</Text>}
        </TouchableOpacity>
      )}

      {eligibility?.eligible && !showRateForm && (
        <TouchableOpacity style={styles.rateButton} onPress={() => setShowRateForm(true)}>
          <Text style={styles.rateButtonText}>Rate this transaction</Text>
        </TouchableOpacity>
      )}

      {eligibility?.alreadyRated && <Text style={styles.ratedText}>You&apos;ve rated this transaction. Thanks!</Text>}

      {showRateForm && (
        <View style={styles.rateForm}>
          <RatingStars value={score} onChange={setScore} />
          <TextInput
            style={styles.commentInput}
            placeholder="Optional comment"
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmitRating} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit rating</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function OrdersScreen({ navigation }: any) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchMyOrders();
      setOrders(data);
    } catch {
      // leave orders as-is; a pull-to-refresh will retry
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (orders === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B8860B" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={orders}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No orders yet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <OrderCard order={item} currentUserId={user!.id} onUpdated={load} navigation={navigation} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: '#888', fontSize: 15 },
  list: { padding: 16 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#f2f2f2' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderText: { fontSize: 9, color: '#999' },
  info: { flex: 1, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  status: { fontSize: 12, color: '#B8860B', fontWeight: '600' },
  subtitle: { fontSize: 12, color: '#888', marginTop: 2 },
  completeButton: { backgroundColor: '#2E7D32', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 10 },
  completeButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  rateButton: { borderWidth: 1, borderColor: '#B8860B', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 10 },
  rateButtonText: { color: '#B8860B', fontWeight: '600', fontSize: 13 },
  ratedText: { color: '#888', fontSize: 12, marginTop: 10 },
  rateForm: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 10 },
  commentInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, marginTop: 8, fontSize: 13, minHeight: 50 },
  submitButton: { backgroundColor: '#B8860B', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 8 },
  submitButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
