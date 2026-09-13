import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { fetchConversations, type ConversationSummary } from '../api/conversations';

export default function MessagesScreen({ navigation }: any) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchConversations();
      setConversations(data);
      setError(null);
    } catch {
      setError('Could not load your messages.');
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

  if (conversations === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B8860B" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={conversations}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.centered}>
          {error ? <Text style={styles.errorText}>{error}</Text> : <Text style={styles.emptyText}>No conversations yet.</Text>}
        </View>
      }
      renderItem={({ item }) => {
        const otherParty = item.buyerId === user?.id ? item.seller : item.buyer;
        return (
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Conversation', { id: item.id })}>
            {item.listing.images[0] ? (
              <Image source={{ uri: item.listing.images[0] }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Text style={styles.thumbPlaceholderText}>No photo</Text>
              </View>
            )}
            <View style={styles.info}>
              <View style={styles.titleRow}>
                <Text style={styles.name} numberOfLines={1}>{otherParty.name}</Text>
                {item.unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unreadCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.listingTitle} numberOfLines={1}>{item.listing.title}</Text>
              {item.lastMessage && <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage.body}</Text>}
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: '#888', fontSize: 15 },
  errorText: { color: '#D32F2F', fontSize: 15 },
  list: { padding: 16 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#f2f2f2' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderText: { fontSize: 9, color: '#999' },
  info: { flex: 1, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  badge: { backgroundColor: '#B8860B', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1, marginLeft: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  listingTitle: { fontSize: 12, color: '#888' },
  lastMessage: { fontSize: 13, color: '#555', marginTop: 2 },
});
