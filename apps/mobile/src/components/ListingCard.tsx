import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import type { Listing } from '../api/listings';

export default function ListingCard({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  const priceLabel = `$${Number(listing.price).toFixed(2)}`;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      {listing.images[0] ? (
        <Image source={{ uri: listing.images[0] }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderText}>No photo</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
        <Text style={styles.category}>{listing.category}</Text>
        <Text style={styles.price}>{priceLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { width: '48%', marginBottom: 16, backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
  image: { width: '100%', height: 140, backgroundColor: '#f2f2f2' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { color: '#999', fontSize: 12 },
  info: { padding: 10 },
  title: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  category: { fontSize: 12, color: '#888', marginBottom: 4 },
  price: { fontSize: 15, fontWeight: '700', color: '#B8860B' },
});
