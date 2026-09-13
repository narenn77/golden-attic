import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

export default function RatingStars({
  value,
  onChange,
  readOnly = false,
  size = 'md',
}: {
  value: number;
  onChange?: (score: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md';
}) {
  const fontSize = size === 'sm' ? 14 : 24;

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} disabled={readOnly} onPress={() => onChange?.(n)}>
          <Text style={{ fontSize, color: n <= value ? '#F59E0B' : '#D4D4D4' }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
});
