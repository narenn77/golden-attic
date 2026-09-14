import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  fetchListings, pauseListing, resumeListing, deleteListing,
  daysUntilFreeHostingEnds, type Listing,
} from '../api/listings';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', ACTIVE: 'Active', PAUSED: 'Paused', SOLD: 'Sold', EXPIRED: 'Expired', REMOVED: 'Removed',
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#888', ACTIVE: '#2E7D32', PAUSED: '#B8860B', SOLD: '#1565C0', EXPIRED: '#999', REMOVED: '#D32F2F',
};

export default function MyListingsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchListings({ sellerId: user.id, status: 'ALL' });
      const sorted = [...data].sort((a, b) => {
        if ((a.status === 'REMOVED') !== (b.status === 'REMOVED')) return a.status === 'REMOVED' ? 1 : -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setListings(sorted);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not load your listings.');
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handlePause(id: string) {
    setBusyId(id);
    try {
      await pauseListing(id);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not pause this listing.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleResume(id: string) {
    setBusyId(id);
    try {
      await resumeListing(id);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not resume this listing.');
    } finally {
      setBusyId(null);
    }
  }

  function confirmDelete(id: string) {
    Alert.alert('Remove listing', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => handleDelete(id) },
    ]);
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await deleteListing(id);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not remove this listing.');
    } finally {
      setBusyId(null);
    }
  }

  if (listings === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B8860B" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={listings}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>You haven&apos;t listed anything yet.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const daysLeft = daysUntilFreeHostingEnds(item);
        return (
          <View style={styles.row}>
            <TouchableOpacity onPress={() => navigation.navigate('ListingDetail', { id: item.id })}>
              {item.images[0] ? (
                <Image source={{ uri: item.images[0] }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Text style={styles.thumbPlaceholderText}>No photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.info}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <View style={[styles.badge, { backgroundColor: `${STATUS_COLORS[item.status]}20` }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] }]}>{STATUS_LABELS[item.status]}</Text>
                </View>
                {!!item.pendingBidCount && (
                  <View style={styles.bidBadge}>
                    <Text style={styles.bidBadgeText}>{item.pendingBidCount} bid{item.pendingBidCount === 1 ? '' : 's'}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.price}>${Number(item.price).toFixed(2)}</Text>
              {item.status === 'ACTIVE' && daysLeft != null && (
                <Text style={styles.hostingText}>
                  {daysLeft > 0 ? `${daysLeft}d left of free hosting` : 'Hosting fee applies'}
                </Text>
              )}

              <View style={styles.actionsRow}>
                {item.status === 'ACTIVE' && (
                  <TouchableOpacity onPress={() => handlePause(item.id)} disabled={busyId === item.id}>
                    <Text style={styles.actionPause}>Pause</Text>
                  </TouchableOpacity>
                )}
                {item.status === 'PAUSED' && (
                  <TouchableOpacity onPress={() => handleResume(item.id)} disabled={busyId === item.id}>
                    <Text style={styles.actionResume}>Resume</Text>
                  </TouchableOpacity>
                )}
                {item.status !== 'REMOVED' && (
                  <TouchableOpacity onPress={() => confirmDelete(item.id)} disabled={busyId === item.id}>
                    <Text style={styles.actionDelete}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: '#888', fontSize: 15 },
  list: { padding: 16 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  thumb: { width: 70, height: 70, borderRadius: 8, backgroundColor: '#f2f2f2' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderText: { fontSize: 10, color: '#999' },
  info: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  title: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  bidBadge: { backgroundColor: '#B8860B', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  bidBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  price: { fontSize: 14, color: '#666', marginBottom: 2 },
  hostingText: { fontSize: 12, color: '#999', marginBottom: 4 },
  actionsRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  actionPause: { color: '#8B6914', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  actionResume: { color: '#2E7D32', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  actionDelete: { color: '#D32F2F', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
});
