import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { likeListing, unlikeListing } from '../api/listings';

export default function LikeButton({
  listingId,
  initialLiked,
  initialCount,
  isOwner,
  size = 'md',
}: {
  listingId: string;
  initialLiked: boolean;
  initialCount: number;
  isOwner: boolean;
  size?: 'sm' | 'md';
}) {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  if (isOwner) {
    return <Text style={[styles.text, size === 'sm' && styles.textSm]}>♥ {count}</Text>;
  }

  async function toggle() {
    if (!user) {
      navigation.navigate('Login');
      return;
    }

    setBusy(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => c + (wasLiked ? -1 : 1));

    try {
      const result = wasLiked ? await unlikeListing(listingId) : await likeListing(listingId);
      setLiked(result.liked);
      setCount(result.likeCount);
    } catch {
      setLiked(wasLiked);
      setCount((c) => c + (wasLiked ? 1 : -1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <TouchableOpacity onPress={toggle} disabled={busy} style={styles.button}>
      {busy ? (
        <ActivityIndicator size="small" color="#D32F2F" />
      ) : (
        <Text style={[styles.text, size === 'sm' && styles.textSm, liked && styles.liked]}>
          {liked ? '♥' : '♡'} {count}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { paddingVertical: 2, paddingHorizontal: 4 },
  text: { fontSize: 15, color: '#888' },
  textSm: { fontSize: 13 },
  liked: { color: '#D32F2F' },
});
