import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native';
import { fetchListing, deleteListing, pauseListing, resumeListing, daysUntilFreeHostingEnds } from '../api/listings';
import { startConversation } from '../api/conversations';
import { fetchUserRatings } from '../api/ratings';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import LikeButton from '../components/LikeButton';
import RatingStars from '../components/RatingStars';

export default function ListingDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { user } = useAuth();
  const [listing, setListing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [pausingOrResuming, setPausingOrResuming] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [sellerRating, setSellerRating] = useState<{ average: number | null; count: number } | null>(null);

  useEffect(() => {
    fetchListing(id)
      .then((data) => {
        setListing(data);
        fetchUserRatings(data.sellerId)
          .then((r) => setSellerRating({ average: r.average, count: r.count }))
          .catch(() => {});
      })
      .catch(() => Alert.alert('Error', 'Could not load this listing.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function placeBid() {
    const amount = parseFloat(bidAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid bid amount.');
      return;
    }
    setSubmittingBid(true);
    try {
      await apiRequest('/bids', { method: 'POST', body: { listingId: id, amount } });
      Alert.alert('Bid placed', 'Your bid has been sent to the seller.');
      setBidAmount('');
    } catch (err: any) {
      Alert.alert('Could not place bid', err?.message || 'Something went wrong.');
    } finally {
      setSubmittingBid(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Remove listing', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: handleDelete },
    ]);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteListing(id);
      navigation.navigate('Browse');
    } catch (err: any) {
      Alert.alert('Could not remove listing', err?.message || 'Something went wrong.');
      setDeleting(false);
    }
  }

  async function handlePause() {
    setPausingOrResuming(true);
    try {
      await pauseListing(id);
      setListing((prev: any) => ({ ...prev, status: 'PAUSED' }));
    } catch (err: any) {
      Alert.alert('Could not pause listing', err?.message || 'Something went wrong.');
    } finally {
      setPausingOrResuming(false);
    }
  }

  async function handleResume() {
    setPausingOrResuming(true);
    try {
      await resumeListing(id);
      setListing((prev: any) => ({ ...prev, status: 'ACTIVE' }));
    } catch (err: any) {
      Alert.alert('Could not resume listing', err?.message || 'Something went wrong.');
    } finally {
      setPausingOrResuming(false);
    }
  }

  async function handleMessageSeller() {
    setMessaging(true);
    try {
      const conversation = await startConversation(id);
      navigation.navigate('Conversation', { id: conversation.id });
    } catch (err: any) {
      Alert.alert('Could not start conversation', err?.message || 'Something went wrong.');
    } finally {
      setMessaging(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B8860B" />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.centered}>
        <Text>Listing not found.</Text>
      </View>
    );
  }

  const isOwner = user?.id === listing.sellerId;
  const daysLeft = daysUntilFreeHostingEnds(listing);

  return (
    <ScrollView style={styles.container}>
      {listing.images[activeImage] ? (
        <Image source={{ uri: listing.images[activeImage] }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={{ color: '#999' }}>No photo</Text>
        </View>
      )}

      {listing.images.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow} contentContainerStyle={styles.thumbRowContent}>
          {listing.images.map((src: string, i: number) => (
            <TouchableOpacity key={i} onPress={() => setActiveImage(i)}>
              <Image
                source={{ uri: src }}
                style={[styles.thumb, i === activeImage && styles.thumbActive]}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{listing.title}</Text>
          <LikeButton
            listingId={listing.id}
            initialLiked={listing.likedByMe}
            initialCount={listing.likeCount}
            isOwner={isOwner}
          />
        </View>
        <Text style={styles.category}>
          {listing.category}
          {(listing.year || listing.country) ? ` · ${[listing.year, listing.country].filter(Boolean).join(', ')}` : ''}
        </Text>
        <Text style={styles.price}>${Number(listing.price).toFixed(2)}</Text>
        <Text style={styles.description}>{listing.description}</Text>

        {listing.seller && (
          <View style={styles.sellerRow}>
            <Text style={styles.seller}>Sold by {listing.seller.name}</Text>
            {sellerRating && sellerRating.count > 0 && (
              <View style={styles.sellerRatingRow}>
                <RatingStars value={Math.round(sellerRating.average || 0)} readOnly size="sm" />
                <Text style={styles.sellerRatingCount}>({sellerRating.count})</Text>
              </View>
            )}
          </View>
        )}

        {!isOwner && !user && listing.status === 'ACTIVE' && (
          <View style={styles.loginPrompt}>
            <Text style={styles.loginPromptText}>Log in to buy or place a bid on this item.</Text>
            <TouchableOpacity style={styles.loginButton} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginButtonText}>Log In</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isOwner && user && listing.status === 'ACTIVE' && (
          <TouchableOpacity
            style={styles.buyButton}
            onPress={() => navigation.navigate('Checkout', { listingId: listing.id, title: listing.title, price: listing.price })}
          >
            <Text style={styles.buyButtonText}>Buy Now — ${Number(listing.price).toFixed(2)}</Text>
          </TouchableOpacity>
        )}

        {!isOwner && user && listing.status === 'ACTIVE' && (
          <TouchableOpacity style={styles.messageButton} onPress={handleMessageSeller} disabled={messaging}>
            {messaging ? <ActivityIndicator color="#444" /> : <Text style={styles.messageButtonText}>Message seller</Text>}
          </TouchableOpacity>
        )}

        {!isOwner && user && listing.allowBidding && listing.status === 'ACTIVE' && (
          <View style={styles.bidSection}>
            <Text style={styles.bidLabel}>Place a bid</Text>
            <View style={styles.bidRow}>
              <TextInput
                style={styles.bidInput}
                placeholder="Amount ($)"
                keyboardType="decimal-pad"
                value={bidAmount}
                onChangeText={setBidAmount}
              />
              <TouchableOpacity style={styles.bidButton} onPress={placeBid} disabled={submittingBid}>
                {submittingBid ? <ActivityIndicator color="#fff" /> : <Text style={styles.bidButtonText}>Bid</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isOwner && (
          <View>
            <View style={styles.ownerBanner}>
              <Text style={styles.ownerBannerText}>This is your listing</Text>
              {listing.status === 'ACTIVE' && daysLeft != null && (
                <Text style={styles.ownerBannerSubtext}>
                  {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left of free hosting` : 'Hosting fee now applies (1%/month)'}
                </Text>
              )}
              {listing.status === 'PAUSED' && <Text style={styles.ownerBannerSubtext}>Paused - hidden from buyers</Text>}
            </View>

            {listing.status === 'ACTIVE' && (
              <TouchableOpacity style={styles.pauseButton} onPress={handlePause} disabled={pausingOrResuming}>
                {pausingOrResuming ? <ActivityIndicator color="#8B6914" /> : <Text style={styles.pauseButtonText}>Pause listing</Text>}
              </TouchableOpacity>
            )}
            {listing.status === 'PAUSED' && (
              <TouchableOpacity style={styles.resumeButton} onPress={handleResume} disabled={pausingOrResuming}>
                {pausingOrResuming ? <ActivityIndicator color="#2E7D32" /> : <Text style={styles.resumeButtonText}>Resume listing</Text>}
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator color="#D32F2F" />
              ) : (
                <Text style={styles.deleteButtonText}>Remove listing</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: 300, backgroundColor: '#f2f2f2' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbRow: { marginTop: 10 },
  thumbRowContent: { paddingHorizontal: 20, gap: 8 },
  thumb: { width: 60, height: 60, borderRadius: 8, marginRight: 8, borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: '#B8860B' },
  body: { padding: 20 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4, flex: 1, marginRight: 8 },
  category: { fontSize: 14, color: '#888', marginBottom: 8 },
  price: { fontSize: 24, fontWeight: '700', color: '#B8860B', marginBottom: 16 },
  description: { fontSize: 15, lineHeight: 22, color: '#333', marginBottom: 16 },
  seller: { fontSize: 13, color: '#666' },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sellerRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sellerRatingCount: { fontSize: 11, color: '#999' },
  loginPrompt: { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 16, alignItems: 'center' },
  loginPromptText: { color: '#444', marginBottom: 12, textAlign: 'center' },
  loginButton: { backgroundColor: '#B8860B', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24 },
  loginButtonText: { color: '#fff', fontWeight: '600' },
  buyButton: { backgroundColor: '#2E7D32', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 12 },
  buyButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  messageButton: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 10 },
  messageButtonText: { color: '#444', fontWeight: '600' },
  bidSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 16 },
  bidLabel: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  bidRow: { flexDirection: 'row', gap: 8 },
  bidInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16 },
  bidButton: { backgroundColor: '#B8860B', borderRadius: 8, paddingHorizontal: 20, justifyContent: 'center' },
  bidButtonText: { color: '#fff', fontWeight: '600' },
  ownerBanner: { backgroundColor: '#FFF8E1', padding: 12, borderRadius: 8, marginTop: 12 },
  ownerBannerText: { color: '#8B6914', textAlign: 'center', fontWeight: '600' },
  ownerBannerSubtext: { color: '#8B6914', textAlign: 'center', fontSize: 13, marginTop: 4 },
  pauseButton: { borderWidth: 1, borderColor: '#B8860B', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  pauseButtonText: { color: '#8B6914', fontWeight: '600' },
  resumeButton: { borderWidth: 1, borderColor: '#2E7D32', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  resumeButtonText: { color: '#2E7D32', fontWeight: '600' },
  deleteButton: { borderWidth: 1, borderColor: '#D32F2F', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  deleteButtonText: { color: '#D32F2F', fontWeight: '600' },
});
