import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

export const messagesRouter = Router();

messagesRouter.use(authenticate);

messagesRouter.get('/inbox', async (req, res, next) => {
  try {
    const items = await prisma.message.findMany({
      where: { receiverId: req.user!.userId, deletedByReceiver: false },
      orderBy: { sentAt: 'desc' },
      include: { sender: { select: { id: true, username: true, firstName: true, lastName: true } } },
    });
    res.json(items);
  } catch (e) { next(e); }
});

messagesRouter.get('/sent', async (req, res, next) => {
  try {
    const items = await prisma.message.findMany({
      where: { senderId: req.user!.userId, deletedBySender: false },
      orderBy: { sentAt: 'desc' },
      include: { receiver: { select: { id: true, username: true, firstName: true, lastName: true } } },
    });
    res.json(items);
  } catch (e) { next(e); }
});

messagesRouter.get('/unread-count', async (req, res, next) => {
  try {
    const count = await prisma.message.count({
      where: { receiverId: req.user!.userId, deletedByReceiver: false, readAt: null },
    });
    res.json({ count });
  } catch (e) { next(e); }
});

messagesRouter.post('/:id/read', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg || msg.receiverId !== req.user!.userId) throw new HttpError(404, 'Message not found');
    const updated = await prisma.message.update({
      where: { id },
      data: { readAt: msg.readAt ?? new Date() },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

// The assignment scopes messaging to "participants ↔ organizers", so every
// message must be anchored to an event the two users actually share. We require
// `relatedEventId` and confirm that one side is the organizer and the other
// has a booking — admins are exempt so they can step in if needed.
const sendSchema = z.object({
  receiverId: z.number().int(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  relatedEventId: z.number().int(),
});

messagesRouter.post('/', async (req, res, next) => {
  try {
    const data = sendSchema.parse(req.body);
    const senderId = req.user!.userId;
    if (data.receiverId === senderId) throw new HttpError(400, 'Cannot send a message to yourself');

    const receiver = await prisma.user.findUnique({ where: { id: data.receiverId } });
    if (!receiver) throw new HttpError(404, 'Receiver not found');
    if (receiver.status !== 'APPROVED') throw new HttpError(400, 'Receiver is not an active user');

    if (req.user!.role !== 'ADMIN') {
      const ev = await prisma.event.findUnique({
        where: { id: data.relatedEventId },
        select: { id: true, status: true, organizerId: true },
      });
      if (!ev) throw new HttpError(404, 'Related event not found');

      const senderIsOrganizer = ev.organizerId === senderId;
      const receiverIsOrganizer = ev.organizerId === data.receiverId;

      // Exactly one side must be the organizer (forbid attendee↔attendee chatter
      // and stop the messaging endpoint from being used as a generic DM system).
      if (senderIsOrganizer === receiverIsOrganizer) {
        throw new HttpError(403, 'Messaging is only allowed between the organizer and a participant of the event');
      }

      if (senderIsOrganizer) {
        // Organizer reaching out to a participant — the participant must have
        // an actual (non-cancelled) booking on this event.
        const hasBooking = await prisma.booking.findFirst({
          where: { eventId: ev.id, attendeeId: data.receiverId, status: { not: 'CANCELLED' } },
          select: { id: true },
        });
        if (!hasBooking) {
          throw new HttpError(403, 'Recipient is not a participant of this event');
        }
      } else {
        // Participant (or prospective participant) writing to the organizer —
        // allowed for any publicly visible event, so inquiries before booking
        // are possible. Drafts are organizer-private and therefore off-limits.
        if (ev.status === 'DRAFT') {
          throw new HttpError(404, 'Related event not found');
        }
      }
    }

    const msg = await prisma.message.create({
      data: {
        senderId,
        receiverId: data.receiverId,
        subject: data.subject,
        body: data.body,
        relatedEventId: data.relatedEventId,
      },
    });
    res.status(201).json(msg);
  } catch (e) { next(e); }
});

messagesRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const box = req.query.box === 'sent' ? 'sent' : 'inbox';
    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) throw new HttpError(404, 'Message not found');

    if (box === 'inbox') {
      if (msg.receiverId !== req.user!.userId) throw new HttpError(403, 'Not your message');
      await prisma.message.update({ where: { id }, data: { deletedByReceiver: true } });
    } else {
      if (msg.senderId !== req.user!.userId) throw new HttpError(403, 'Not your message');
      await prisma.message.update({ where: { id }, data: { deletedBySender: true } });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});
