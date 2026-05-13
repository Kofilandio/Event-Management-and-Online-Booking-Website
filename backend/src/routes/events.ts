import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { prisma } from '../lib/prisma.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { env } from '../lib/env.js';

export const eventsRouter = Router();

// uploads
if (!fs.existsSync(env.uploadDir)) fs.mkdirSync(env.uploadDir, { recursive: true });
const upload = multer({
  dest: env.uploadDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) {
      return cb(new HttpError(400, 'Only image files are allowed'));
    }
    cb(null, true);
  },
});

const ticketTypeSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
});

const eventSchema = z.object({
  title: z.string().min(1),
  eventType: z.string().min(1),
  venue: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  startDateTime: z.string(),
  endDateTime: z.string(),
  capacity: z.number().int().positive(),
  description: z.string().min(1),
  categories: z.array(z.string().min(1)).min(1),
  ticketTypes: z.array(ticketTypeSchema).min(1),
});

function validateTicketCapacity(capacity: number, types: { quantity: number }[]) {
  const sum = types.reduce((acc, t) => acc + t.quantity, 0);
  if (sum > capacity) {
    throw new HttpError(400, `Sum of ticket quantities (${sum}) exceeds event capacity (${capacity})`);
  }
}

// PUBLIC: list/search published events with pagination
eventsRouter.get('/', optionalAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 12)));
    const skip = (page - 1) * limit;

    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const title = typeof req.query.title === 'string' ? req.query.title : undefined;
    const description = typeof req.query.description === 'string' ? req.query.description : undefined;
    const dateFrom = typeof req.query.dateFrom === 'string' ? new Date(req.query.dateFrom) : undefined;
    const dateTo = typeof req.query.dateTo === 'string' ? new Date(req.query.dateTo) : undefined;
    const priceMin = req.query.priceMin ? Number(req.query.priceMin) : undefined;
    const priceMax = req.query.priceMax ? Number(req.query.priceMax) : undefined;
    const city = typeof req.query.city === 'string' ? req.query.city : undefined;

    const where: any = { status: 'PUBLISHED' };
    if (title) where.title = { contains: title, mode: 'insensitive' };
    if (description) where.description = { contains: description, mode: 'insensitive' };
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (dateFrom || dateTo) {
      where.startDateTime = {};
      if (dateFrom) where.startDateTime.gte = dateFrom;
      if (dateTo) where.startDateTime.lte = dateTo;
    }
    if (category) where.categories = { some: { name: { equals: category, mode: 'insensitive' } } };
    if (priceMin != null || priceMax != null) {
      where.ticketTypes = { some: { price: {
        ...(priceMin != null ? { gte: priceMin } : {}),
        ...(priceMax != null ? { lte: priceMax } : {}),
      } } };
    }

    const [items, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDateTime: 'asc' },
        include: {
          categories: true,
          ticketTypes: true,
          photos: true,
          organizer: { select: { id: true, username: true } },
        },
      }),
      prisma.event.count({ where }),
    ]);

    res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (e) { next(e); }
});

// list distinct categories (helper for filters)
eventsRouter.get('/categories', async (_req, res, next) => {
  try {
    const cats = await prisma.eventCategory.findMany({
      where: { event: { status: 'PUBLISHED' } },
      select: { name: true },
      distinct: ['name'],
      orderBy: { name: 'asc' },
    });
    res.json(cats.map((c) => c.name));
  } catch (e) { next(e); }
});

// current user's events
eventsRouter.get('/mine', authenticate, async (req, res, next) => {
  try {
    const items = await prisma.event.findMany({
      where: { organizerId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        categories: true,
        ticketTypes: true,
        photos: true,
        _count: { select: { bookings: true } },
      },
    });
    res.json(items);
  } catch (e) { next(e); }
});

// In-memory throttle for view tracking. Limits a single (user,event) pair to one
// EventView row every VIEW_DEDUP_WINDOW_MS — prevents trivial refresh-spam from
// polluting the recommender training set.
const VIEW_DEDUP_WINDOW_MS = 30 * 60 * 1000;
const recentViewTouches = new Map<string, number>();
function shouldRecordView(userId: number, eventId: number): boolean {
  const k = `${userId}:${eventId}`;
  const now = Date.now();
  const last = recentViewTouches.get(k);
  if (last && now - last < VIEW_DEDUP_WINDOW_MS) return false;
  recentViewTouches.set(k, now);
  // crude cap so the map doesn't grow unbounded on long-running instances
  if (recentViewTouches.size > 5000) {
    for (const [key, ts] of recentViewTouches) {
      if (now - ts > VIEW_DEDUP_WINDOW_MS) recentViewTouches.delete(key);
    }
  }
  return true;
}

// event detail
eventsRouter.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        categories: true,
        ticketTypes: true,
        photos: true,
        organizer: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
    });
    if (!event) throw new HttpError(404, 'Event not found');

    // hide non-published events from non-owner / non-admin
    if (event.status !== 'PUBLISHED' && event.status !== 'CANCELLED' && event.status !== 'COMPLETED') {
      const isOwner = req.user?.userId === event.organizerId;
      const isAdmin = req.user?.role === 'ADMIN';
      if (!isOwner && !isAdmin) throw new HttpError(404, 'Event not found');
    }

    // Record a view only for genuine participant-style users: skip owners,
    // skip admins (their browsing would poison the recommender), and de-dup
    // within a 30-min window per (user,event).
    if (
      req.user &&
      req.user.userId !== event.organizerId &&
      req.user.role !== 'ADMIN' &&
      shouldRecordView(req.user.userId, event.id)
    ) {
      prisma.eventView.create({
        data: { userId: req.user.userId, eventId: event.id },
      }).catch(() => { /* fire-and-forget; recommender freshness is best-effort */ });
    }

    res.json(event);
  } catch (e) { next(e); }
});

// CREATE event
eventsRouter.post('/', authenticate, async (req, res, next) => {
  try {
    const data = eventSchema.parse(req.body);
    if (new Date(data.endDateTime) <= new Date(data.startDateTime)) {
      throw new HttpError(400, 'End time must be after start time');
    }
    validateTicketCapacity(data.capacity, data.ticketTypes);

    const event = await prisma.event.create({
      data: {
        title: data.title,
        eventType: data.eventType,
        venue: data.venue,
        address: data.address,
        city: data.city,
        country: data.country,
        latitude: data.latitude,
        longitude: data.longitude,
        startDateTime: new Date(data.startDateTime),
        endDateTime: new Date(data.endDateTime),
        capacity: data.capacity,
        description: data.description,
        organizerId: req.user!.userId,
        categories: { create: data.categories.map((name) => ({ name })) },
        ticketTypes: { create: data.ticketTypes.map((t) => ({
          name: t.name, price: t.price, quantity: t.quantity, available: t.quantity,
        })) },
      },
      include: { categories: true, ticketTypes: true },
    });
    res.status(201).json(event);
  } catch (e) { next(e); }
});

// UPDATE event
eventsRouter.put('/:id', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = eventSchema.parse(req.body);

    const existing = await prisma.event.findUnique({
      where: { id },
      include: { ticketTypes: { include: { bookings: true } } },
    });
    if (!existing) throw new HttpError(404, 'Event not found');
    if (existing.organizerId !== req.user!.userId && req.user!.role !== 'ADMIN') {
      throw new HttpError(403, 'Only the organizer can edit this event');
    }
    if (existing.status === 'CANCELLED') throw new HttpError(400, 'Cannot edit a cancelled event');
    if (existing.status === 'COMPLETED') throw new HttpError(400, 'Cannot edit a completed event');

    if (new Date(data.endDateTime) <= new Date(data.startDateTime)) {
      throw new HttpError(400, 'End time must be after start time');
    }
    validateTicketCapacity(data.capacity, data.ticketTypes);

    // Aggregate safeguard: even if every individual ticket-type passes the
    // per-type "quantity >= already booked" rule below, the new total capacity
    // must still cover all confirmed bookings across all ticket types.
    const totalBookedAcrossEvent = existing.ticketTypes.reduce(
      (s, t) => s + (t.quantity - t.available),
      0,
    );
    if (data.capacity < totalBookedAcrossEvent) {
      throw new HttpError(
        400,
        `Capacity (${data.capacity}) cannot be less than current confirmed bookings (${totalBookedAcrossEvent})`,
      );
    }

    // For each existing ticket type — preserve booked count (quantity - available)
    // Disallow reducing quantity below already-booked count.
    const updated = await prisma.$transaction(async (tx) => {
      // wipe categories & re-create
      await tx.eventCategory.deleteMany({ where: { eventId: id } });

      // ticket types: update existing or create new, prevent deletion of ones with bookings
      const existingTtMap = new Map(existing.ticketTypes.map((t) => [t.id, t]));
      const submittedIds = new Set(
        data.ticketTypes.filter((t) => t.id != null).map((t) => t.id as number),
      );

      // Check: ticket types being removed must have no bookings
      for (const tt of existing.ticketTypes) {
        if (!submittedIds.has(tt.id) && tt.bookings.length > 0) {
          throw new HttpError(400, `Cannot remove ticket type "${tt.name}" with existing bookings`);
        }
      }
      // Delete removed
      await tx.ticketType.deleteMany({
        where: { eventId: id, id: { notIn: Array.from(submittedIds) } },
      });

      // Upsert each submitted
      for (const t of data.ticketTypes) {
        if (t.id && existingTtMap.has(t.id)) {
          const old = existingTtMap.get(t.id)!;
          const booked = old.quantity - old.available;
          if (t.quantity < booked) {
            throw new HttpError(400, `Ticket type "${t.name}" already has ${booked} bookings — quantity cannot be less than that`);
          }
          await tx.ticketType.update({
            where: { id: t.id },
            data: {
              name: t.name,
              price: t.price,
              quantity: t.quantity,
              available: t.quantity - booked,
            },
          });
        } else {
          await tx.ticketType.create({
            data: {
              eventId: id,
              name: t.name,
              price: t.price,
              quantity: t.quantity,
              available: t.quantity,
            },
          });
        }
      }

      return tx.event.update({
        where: { id },
        data: {
          title: data.title,
          eventType: data.eventType,
          venue: data.venue,
          address: data.address,
          city: data.city,
          country: data.country,
          latitude: data.latitude,
          longitude: data.longitude,
          startDateTime: new Date(data.startDateTime),
          endDateTime: new Date(data.endDateTime),
          capacity: data.capacity,
          description: data.description,
          categories: { create: data.categories.map((name) => ({ name })) },
        },
        include: { categories: true, ticketTypes: true, photos: true },
      });
    });

    res.json(updated);
  } catch (e) { next(e); }
});

// PUBLISH
eventsRouter.post('/:id/publish', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new HttpError(404, 'Event not found');
    if (event.organizerId !== req.user!.userId) throw new HttpError(403, 'Not your event');
    if (event.status !== 'DRAFT') throw new HttpError(400, `Cannot publish event with status ${event.status}`);
    const updated = await prisma.event.update({ where: { id }, data: { status: 'PUBLISHED' } });
    res.json(updated);
  } catch (e) { next(e); }
});

// CANCEL
eventsRouter.post('/:id/cancel', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const event = await prisma.event.findUnique({
      where: { id },
      include: { bookings: { where: { status: 'CONFIRMED' }, select: { attendeeId: true } } },
    });
    if (!event) throw new HttpError(404, 'Event not found');
    if (event.organizerId !== req.user!.userId) throw new HttpError(403, 'Not your event');
    if (event.status !== 'PUBLISHED') throw new HttpError(400, `Cannot cancel event with status ${event.status}`);

    // Wrap the status flip and the notifications in a single transaction so a
    // failure to enqueue the messages rolls back the cancellation — attendees
    // must never be left silently unnotified.
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.event.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      if (event.bookings.length > 0) {
        const uniqueAttendees = Array.from(new Set(event.bookings.map((b) => b.attendeeId)));
        await tx.message.createMany({
          data: uniqueAttendees.map((uid) => ({
            senderId: event.organizerId,
            receiverId: uid,
            subject: `Event "${event.title}" was cancelled`,
            body: `We regret to inform you that the event "${event.title}" scheduled for ${event.startDateTime.toISOString()} has been cancelled.`,
            relatedEventId: event.id,
          })),
        });
      }

      return u;
    });

    res.json(updated);
  } catch (e) { next(e); }
});

// DELETE (only if DRAFT or no bookings)
eventsRouter.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const event = await prisma.event.findUnique({
      where: { id },
      include: { _count: { select: { bookings: true } } },
    });
    if (!event) throw new HttpError(404, 'Event not found');
    if (event.organizerId !== req.user!.userId && req.user!.role !== 'ADMIN') {
      throw new HttpError(403, 'Not your event');
    }
    if (event.status !== 'DRAFT' && event._count.bookings > 0) {
      throw new HttpError(400, 'Cannot delete event after first booking. Cancel instead.');
    }
    await prisma.event.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Bookings for an event (organizer only)
eventsRouter.get('/:id/bookings', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new HttpError(404, 'Event not found');
    if (event.organizerId !== req.user!.userId && req.user!.role !== 'ADMIN') {
      throw new HttpError(403, 'Not your event');
    }
    const bookings = await prisma.booking.findMany({
      where: { eventId: id },
      orderBy: { bookedAt: 'desc' },
      include: {
        attendee: { select: { id: true, username: true, firstName: true, lastName: true, email: true } },
        ticketType: true,
      },
    });
    res.json(bookings);
  } catch (e) { next(e); }
});

// Upload photo for an event
eventsRouter.post('/:id/photos', authenticate, upload.single('photo'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new HttpError(404, 'Event not found');
    if (event.organizerId !== req.user!.userId) throw new HttpError(403, 'Not your event');
    if (!req.file) throw new HttpError(400, 'No file uploaded');

    // rename to keep original extension (async — never block the event loop)
    const ext = path.extname(req.file.originalname).toLowerCase();
    const safeExt = /^\.(png|jpe?g|webp|gif)$/.test(ext) ? ext : '';
    const newPath = path.join(env.uploadDir, `${req.file.filename}${safeExt}`);
    await fsp.rename(req.file.path, newPath);

    const photo = await prisma.eventPhoto.create({
      data: { eventId: id, filename: path.basename(newPath) },
    });
    res.status(201).json(photo);
  } catch (e) { next(e); }
});

// Delete photo
eventsRouter.delete('/:id/photos/:photoId', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const photoId = Number(req.params.photoId);
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new HttpError(404, 'Event not found');
    if (event.organizerId !== req.user!.userId) throw new HttpError(403, 'Not your event');

    const photo = await prisma.eventPhoto.findUnique({ where: { id: photoId } });
    if (!photo || photo.eventId !== id) throw new HttpError(404, 'Photo not found');

    await fsp.unlink(path.join(env.uploadDir, photo.filename)).catch(() => { /* file already gone */ });
    await prisma.eventPhoto.delete({ where: { id: photoId } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
