import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { containsPhoneNumber } from '../lib/contentFilters.js';

export const conversationsRouter = Router();

// POST /conversations - start (or return the existing) conversation with a
// listing's seller. One conversation per (listing, buyer) pair.
conversationsRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { listingId } = req.body;
  if (!listingId) return res.status(400).json({ error: { message: 'listingId is required' } });

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return res.status(404).json({ error: { message: 'Listing not found' } });
  if (listing.sellerId === req.user!.userId) {
    return res.status(400).json({ error: { message: 'You cannot message yourself about your own listing' } });
  }

  const conversation = await prisma.conversation.upsert({
    where: { listingId_buyerId: { listingId, buyerId: req.user!.userId } },
    create: { listingId, buyerId: req.user!.userId, sellerId: listing.sellerId },
    update: {},
    include: {
      listing: { select: { id: true, title: true, images: true } },
      buyer: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true } },
    },
  });

  res.status(201).json(conversation);
}));

// GET /conversations - every conversation the current user is a part of
// (as either buyer or seller), newest activity first, with a preview of
// the last message and an unread count.
conversationsRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;

  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    orderBy: { updatedAt: 'desc' },
    include: {
      listing: { select: { id: true, title: true, images: true } },
      buyer: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  const withUnread = await Promise.all(
    conversations.map(async (c) => {
      const unreadCount = await prisma.message.count({
        where: { conversationId: c.id, senderId: { not: userId }, readAt: null },
      });
      return { ...c, lastMessage: c.messages[0] ?? null, messages: undefined, unreadCount };
    })
  );

  res.json(withUnread);
}));

// GET /conversations/unread-count - total unread messages across every
// conversation the user is part of, for a nav badge. Cheap enough to poll
// periodically without pulling the full conversation list each time.
conversationsRouter.get('/unread-count', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;

  const count = await prisma.message.count({
    where: {
      senderId: { not: userId },
      readAt: null,
      conversation: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    },
  });

  res.json({ count });
}));

async function getConversationIfParticipant(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      listing: { select: { id: true, title: true, images: true } },
      buyer: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true } },
    },
  });
  if (!conversation) return { conversation: null, isParticipant: false };
  const isParticipant = conversation.buyerId === userId || conversation.sellerId === userId;
  return { conversation, isParticipant };
}

// GET /conversations/:id/messages - fetch a thread's messages, marking
// the other party's messages as read.
conversationsRouter.get('/:id/messages', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { conversation, isParticipant } = await getConversationIfParticipant(String(req.params.id), userId);

  if (!conversation) return res.status(404).json({ error: { message: 'Conversation not found' } });
  if (!isParticipant) return res.status(403).json({ error: { message: 'Not a participant in this conversation' } });

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
  });

  await prisma.message.updateMany({
    where: { conversationId: conversation.id, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });

  res.json({ conversation, messages });
}));

// POST /conversations/:id/messages - send a message in a thread.
conversationsRouter.post('/:id/messages', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { body } = req.body;

  if (!body || typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ error: { message: 'Message body is required' } });
  }
  const trimmed = body.trim().slice(0, 2000);

  if (containsPhoneNumber(trimmed)) {
    return res.status(400).json({
      error: { message: 'For your safety, please keep phone numbers out of messages - all communication should stay on Golden Attic.' },
    });
  }

  const { conversation, isParticipant } = await getConversationIfParticipant(String(req.params.id), userId);
  if (!conversation) return res.status(404).json({ error: { message: 'Conversation not found' } });
  if (!isParticipant) return res.status(403).json({ error: { message: 'Not a participant in this conversation' } });

  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId: userId, body: trimmed },
  });

  // Bumps the conversation to the top of the list for both participants.
  await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

  res.status(201).json(message);
}));
