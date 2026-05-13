import { create } from 'xmlbuilder2';
import { prisma } from '../lib/prisma.js';

async function loadEvents() {
  return prisma.event.findMany({
    include: {
      organizer: true,
      categories: true,
      photos: true,
      ticketTypes: true,
      bookings: { include: { attendee: true } },
    },
    orderBy: { id: 'asc' },
  });
}

function pad(id: number, prefix: string) {
  return `${prefix}${id}`;
}

/**
 * Build XML strictly per the assignment DTD:
 *
 *   <Events>
 *     <Event EventID="EV...">
 *       <Title/> <Category/>+ <EventType/> <Venue/> <Address/> <City/> <Country/>
 *       <GeoLocation Latitude=".." Longitude=".."/>?
 *       <StartDateTime/> <EndDateTime/> <Capacity/>
 *       <TicketTypes><TicketType TicketTypeID="..">...</TicketType>+</TicketTypes>
 *       <Bookings><Booking BookingID="..">...</Booking>*</Bookings>
 *       <Organizer UserID=".."/>
 *       <Status/> <Description/>
 *       <Media><Photo/>*</Media>?
 *     </Event>*
 *   </Events>
 */
export async function buildEventsXml(): Promise<string> {
  const events = await loadEvents();
  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('Events');

  for (const ev of events) {
    const e = root.ele('Event', { EventID: pad(ev.id, 'EV') });
    e.ele('Title').txt(ev.title);
    for (const c of ev.categories) e.ele('Category').txt(c.name);
    e.ele('EventType').txt(ev.eventType);
    e.ele('Venue').txt(ev.venue);
    e.ele('Address').txt(ev.address);
    e.ele('City').txt(ev.city);
    e.ele('Country').txt(ev.country);
    if (ev.latitude != null && ev.longitude != null) {
      e.ele('GeoLocation', { Latitude: String(ev.latitude), Longitude: String(ev.longitude) });
    }
    e.ele('StartDateTime').txt(ev.startDateTime.toISOString());
    e.ele('EndDateTime').txt(ev.endDateTime.toISOString());
    e.ele('Capacity').txt(String(ev.capacity));

    const tts = e.ele('TicketTypes');
    for (const t of ev.ticketTypes) {
      const tt = tts.ele('TicketType', { TicketTypeID: pad(t.id, 'T') });
      tt.ele('Name').txt(t.name);
      tt.ele('Price').txt(t.price.toFixed(2));
      tt.ele('Quantity').txt(String(t.quantity));
      tt.ele('Available').txt(String(t.available));
    }

    const bs = e.ele('Bookings');
    for (const b of ev.bookings) {
      const be = bs.ele('Booking', { BookingID: pad(b.id, 'B') });
      be.ele('Attendee', { UserID: b.attendee.username });
      be.ele('Time').txt(b.bookedAt.toISOString());
      be.ele('TicketTypeRef').txt(pad(b.ticketTypeId, 'T'));
      be.ele('NumberOfTickets').txt(String(b.numberOfTickets));
      be.ele('TotalCost').txt(b.totalCost.toFixed(2));
      be.ele('BookingStatus').txt(b.status);
    }

    e.ele('Organizer', { UserID: ev.organizer.username });
    e.ele('Status').txt(ev.status);
    e.ele('Description').txt(ev.description);

    if (ev.photos.length > 0) {
      const m = e.ele('Media');
      for (const p of ev.photos) m.ele('Photo').txt(p.filename);
    }
  }

  return root.end({ prettyPrint: true });
}

export async function buildEventsJson() {
  const events = await loadEvents();
  return {
    Events: events.map((ev) => ({
      EventID: pad(ev.id, 'EV'),
      Title: ev.title,
      Category: ev.categories.map((c) => c.name),
      EventType: ev.eventType,
      Venue: ev.venue,
      Address: ev.address,
      City: ev.city,
      Country: ev.country,
      GeoLocation: ev.latitude != null && ev.longitude != null
        ? { Latitude: ev.latitude, Longitude: ev.longitude }
        : null,
      StartDateTime: ev.startDateTime.toISOString(),
      EndDateTime: ev.endDateTime.toISOString(),
      Capacity: ev.capacity,
      TicketTypes: ev.ticketTypes.map((t) => ({
        TicketTypeID: pad(t.id, 'T'),
        Name: t.name,
        Price: t.price,
        Quantity: t.quantity,
        Available: t.available,
      })),
      Bookings: ev.bookings.map((b) => ({
        BookingID: pad(b.id, 'B'),
        Attendee: b.attendee.username,
        Time: b.bookedAt.toISOString(),
        TicketTypeRef: pad(b.ticketTypeId, 'T'),
        NumberOfTickets: b.numberOfTickets,
        TotalCost: b.totalCost,
        BookingStatus: b.status,
      })),
      Organizer: ev.organizer.username,
      Status: ev.status,
      Description: ev.description,
      Media: ev.photos.map((p) => p.filename),
    })),
  };
}
