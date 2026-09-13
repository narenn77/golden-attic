import { apiRequest } from './client';

export interface ConversationSummary {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  createdAt: string;
  updatedAt: string;
  listing: { id: string; title: string; images: string[] };
  buyer: { id: string; name: string };
  seller: { id: string; name: string };
  lastMessage: Message | null;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function startConversation(listingId: string) {
  return apiRequest<ConversationSummary>('/conversations', { method: 'POST', body: { listingId } });
}

export function fetchConversations() {
  return apiRequest<ConversationSummary[]>('/conversations');
}

export function fetchMessages(conversationId: string) {
  return apiRequest<{ conversation: ConversationSummary; messages: Message[] }>(`/conversations/${conversationId}/messages`);
}

export function sendMessage(conversationId: string, body: string) {
  return apiRequest<Message>(`/conversations/${conversationId}/messages`, { method: 'POST', body: { body } });
}
