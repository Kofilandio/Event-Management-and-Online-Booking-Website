import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

export const bookingsRouter = Router();

const bookSchema = z.object({
  ticketTypeId: z.number().int(),
  numberOfTickets: z.number().int().positive().max(20),
});

bookingsRouter.post('/events/:eventId/bookings', authenticate, async (req, res, next) => {
  try {
    const eventId = Number(req.params.eventId);
    const { ticketTypeId, numberOfTickets } = bookSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: {
          id: true, status: true, organizerId: true, capacity: true,
          ticketTypes: { select: { id: true, price: true, quantity: true, available: true } },
        },
      });
      if (!event) throw new HttpError(404, 'Event not found');
      if (event.status !== 'PUBLISHED') throw new HttpError(400, 'Event is not open for bookings');
      if (event.organizerId === req.user!.userId) throw new HttpError(400, 'Organizers cannot book their own event');

      const tt = event.ticketTypes.find((t) => t.id === ticketTypeId);
      if (!tt) throw new HttpError(404, 'Ticket type not found');

      const totalBookedBefore = event.ticketTypes.reduce((acc, t) => acc + (t.quantity - t.available), 0);
      if (totalBookedBefore + numberOfTickets > event.capacity) {
        throw new HttpError(400, 'Booking would exceed event capacity');
      }

      // Atomic conditional decrement: this is the only thing that prevents the
      // classic read-then-write race between concurrent bookers. The WHERE clause
      // includes `available >= numberOfTickets`, so two parallel transactions
      // cannot both succeed when only enough stock exists for one of them.
      const update = await tx.ticketType.updateMany({
        where: { id: ticketTypeId, eventId, available: { gte: numberOfTickets } },
        data: { available: { decrement: numberOfTickets } },
      });
      if (update.count === 0) {
        throw new HttpError(409, 'Not enough tickets available — please try again');
      }

      const totalCost = tt.price * numberOfTickets;

      return tx.booking.create({
        data: {
          eventId,
          attendeeId: req.user!.userId,
          ticketTypeId,
          numberOfTickets,
          totalCost,
          status: 'CONFIRMED',
        },
        include: {
          event: { select: { id: true, title: true, startDateTime: true, organizerId: true } },
          ticketType: true,
        },
      });
    });

    res.status(201).json(result);
  } catch (e) { next(e); }
});

// my bookings
bookingsRouter.get('/bookings/mine', authenticate, async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { attendeeId: req.user!.userId },
      orderBy: { bookedAt: 'desc' },
      include: {
        event: { select: {
          id: true, title: true, startDateTime: true, venue: true, city: true,
          status: true, organizer: { select: { id: true, username: true } },
        } },
        ticketType: { select: { id: true, name: true, price: true } },
      },
    });
    res.json(bookings);
  } catch (e) { next(e); }
});
