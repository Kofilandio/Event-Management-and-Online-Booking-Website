export type Role = 'ADMIN' | 'USER';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export interface User {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  status?: UserStatus;
}

export interface FullUser extends User {
  phone: string;
  address: string;
  city: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  afm: string;
  createdAt: string;
  status: UserStatus;
}

export interface Category { id: number; eventId: number; name: string; }
export interface Photo { id: number; eventId: number; filename: string; }

export interface TicketType {
  id: number;
  eventId: number;
  name: string;
  price: number;
  quantity: number;
  available: number;
}

export interface Event {
  id: number;
  title: string;
  eventType: string;
  venue: string;
  address: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  startDateTime: string;
  endDateTime: string;
  capacity: number;
  description: string;
  status: EventStatus;
  organizerId: number;
  organizer?: { id: number; username: string; firstName?: string; lastName?: string };
  categories: Category[];
  ticketTypes: TicketType[];
  photos: Photo[];
  _count?: { bookings: number };
}

export interface Booking {
  id: number;
  eventId: number;
  attendeeId: number;
  ticketTypeId: number;
  numberOfTickets: number;
  totalCost: number;
  status: BookingStatus;
  bookedAt: string;
  event?: Event;
  ticketType?: TicketType;
  attendee?: User;
}

export interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  subject: string;
  body: string;
  sentAt: string;
  readAt: string | null;
  relatedEventId?: number | null;
  sender?: User;
  receiver?: User;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
