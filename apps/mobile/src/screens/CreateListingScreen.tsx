import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { requestAiDraft, createListing, publishListing, type AiListingDraft } from '../api/listings';

const MAX_IMAGES = 5;

export default function CreateListingScreen({ navigation }: any) {
  const [images, setImages] = useState<string[]>([]); // data URLs
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState<AiListingDraft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Editable fields, pre-filled from the AI draft once generated
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [year, setYear] = useState('');
  const [country, setCountry] = useState('');

  async function pickImage() {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Limit reached', `You can add up to ${MAX_IMAGES} photos.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to add pictures of your item.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      const asset = result.assets[0];
      const mime = asset.mimeType || 'image/jpeg';
      setImages((prev) => [...prev, `data:${mime};base64,${asset.base64}`]);
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function generateDraft() {
    if (images.length === 0) {
      Alert.alert('Add a photo first', 'Take or choose at least one photo of your item.');
      return;
    }
    setDrafting(true);
    try {
      const { draft } = await requestAiDraft({ images, note: note.trim() || undefined });
      setDraft(draft);
      setTitle(draft.title);
      setDescription(draft.description);
      setCategory(draft.category);
      setPrice(String(draft.suggestedPriceUsd));
      setYear(draft.year != null ? String(draft.year) : '');
      setCountry(draft.country || '');
    } catch (err: any) {
      Alert.alert('Could not generate a draft', err?.message || 'Please try again, or fill in the details yourself below.');
    } finally {
      setDrafting(false);
    }
  }

  async function handlePublish() {
    if (!title.trim() || !description.trim() || !category.trim() || !price) {
      Alert.alert('Missing details', 'Please fill in a title, description, category, and price.');
      return;
    }
    const priceNumber = parseFloat(price);
    if (!priceNumber || priceNumber <= 0) {
      Alert.alert('Invalid price', 'Enter a valid price greater than $0.');
      return;
    }

    setPublishing(true);
    try {
      const listing = await createListing({
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        price: priceNumber,
        images,
        aiGenerated: draft !== null,
        year: year.trim() ? parseInt(year.trim(), 10) : null,
        country: country.trim() || null,
      });
      await publishListing(listing.id);
      Alert.alert('Listing published!', 'Your item is now live.', [
        { text: 'OK', onPress: () => navigation.navigate('Browse') },
      ]);
    } catch (err: any) {
      Alert.alert('Could not publish', err?.message || 'Something went wrong.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Sell an item</Text>
      <Text style={styles.subheading}>Add a few photos and let AI draft the listing for you.</Text>

      <View style={styles.imageRow}>
        {images.map((uri, i) => (
          <View key={i} style={styles.thumbWrap}>
            <Image source={{ uri }} style={styles.thumb} />
            <TouchableOpacity style={styles.removeBadge} onPress={() => removeImage(i)}>
              <Text style={styles.removeBadgeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        {images.length < MAX_IMAGES && (
          <TouchableOpacity style={styles.addPhoto} onPress={pickImage}>
            <Text style={styles.addPhotoText}>+ Add{'\n'}Photo</Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        style={styles.noteInput}
        placeholder="Anything you know about it? (optional) e.g. 'found in grandma's attic, 1950s stamps'"
        value={note}
        onChangeText={setNote}
        multiline
      />

      <TouchableOpacity style={styles.aiButton} onPress={generateDraft} disabled={drafting}>
        {drafting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.aiButtonText}>✨ Draft listing with AI</Text>
        )}
      </TouchableOpacity>

      {draft && draft.confidence === 'low' && (
        <Text style={styles.lowConfidenceNote}>
          The AI wasn't fully sure about this item — please double check the details below before publishing.
        </Text>
      )}

      <Text style={styles.sectionLabel}>Review &amp; edit before publishing</Text>

      <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <TextInput style={styles.input} placeholder="Category" value={category} onChangeText={setCategory} />
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder="Year (optional)"
          keyboardType="number-pad"
          value={year}
          onChangeText={setYear}
        />
        <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder="Country (optional)"
          value={country}
          onChangeText={setCountry}
        />
      </View>
      <TextInput
        style={styles.input}
        placeholder="Price ($)"
        keyboardType="decimal-pad"
        value={price}
        onChangeText={setPrice}
      />

      <TouchableOpacity style={styles.publishButton} onPress={handlePublish} disabled={publishing}>
        {publishing ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishButtonText}>Publish Listing</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subheading: { fontSize: 14, color: '#666', marginBottom: 20 },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#f2f2f2' },
  removeBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#333', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  removeBadgeText: { color: '#fff', fontSize: 12 },
  addPhoto: { width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addPhotoText: { textAlign: 'center', fontSize: 12, color: '#888' },
  noteInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, minHeight: 60, textAlignVertical: 'top', fontSize: 14 },
  aiButton: { backgroundColor: '#6B4EE6', borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 8 },
  aiButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  lowConfidenceNote: { color: '#8B6914', fontSize: 13, marginBottom: 12, fontStyle: 'italic' },
  sectionLabel: { fontSize: 15, fontWeight: '600', marginTop: 12, marginBottom: 8, color: '#444' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 16 },
  row: { flexDirection: 'row', gap: 10 },
  rowInput: { flex: 1 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  publishButton: { backgroundColor: '#B8860B', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 40 },
  publishButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
