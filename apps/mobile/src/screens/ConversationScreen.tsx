import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { fetchMessages, sendMessage, type Message, type ConversationSummary } from '../api/conversations';

const POLL_INTERVAL_MS = 4000;

export default function ConversationScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { user } = useAuth();
  const [conversation, setConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchMessages(id);
      setConversation(data.conversation);
      setMessages(data.messages);
    } catch {
      setError('Could not load this conversation.');
    }
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (conversation) {
      const otherParty = conversation.buyerId === user?.id ? conversation.seller : conversation.buyer;
      navigation.setOptions({ title: otherParty.name });
    }
  }, [conversation, user, navigation]);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage(id, draft.trim());
      setDraft('');
      await load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      setError(err?.message || 'Could not send that message.');
    } finally {
      setSending(false);
    }
  }

  if (!conversation) {
    return (
      <View style={styles.centered}>
        {error ? <Text style={styles.errorText}>{error}</Text> : <ActivityIndicator size="large" color="#B8860B" />}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMe = item.senderId === user?.id;
          return (
            <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                <Text style={isMe ? styles.bubbleTextMe : styles.bubbleTextThem}>{item.body}</Text>
              </View>
            </View>
          );
        }}
      />

      {error && <Text style={styles.errorBanner}>{error}</Text>}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message..."
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending || !draft.trim()}>
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendButtonText}>Send</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#D32F2F' },
  errorBanner: { color: '#D32F2F', fontSize: 13, textAlign: 'center', paddingVertical: 4 },
  list: { padding: 16 },
  bubbleRow: { flexDirection: 'row', marginBottom: 8 },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowThem: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMe: { backgroundColor: '#B8860B' },
  bubbleThem: { backgroundColor: '#F0F0F0' },
  bubbleTextMe: { color: '#fff', fontSize: 15 },
  bubbleTextThem: { color: '#222', fontSize: 15 },
  inputRow: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendButton: { backgroundColor: '#B8860B', borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center' },
  sendButtonText: { color: '#fff', fontWeight: '600' },
});
