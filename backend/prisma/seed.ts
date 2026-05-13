import { PrismaClient, Role, UserStatus, EventStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@tedi.local',
      phone: '0000000000',
      address: 'N/A',
      city: 'Athens',
      country: 'Greece',
      afm: '000000000',
      role: Role.ADMIN,
      status: UserStatus.APPROVED,
    },
  });

  // Demo organizer
  const organizerPwd = await bcrypt.hash('organizer123', 10);
  const organizer = await prisma.user.upsert({
    where: { username: 'organizer1' },
    update: {},
    create: {
      username: 'organizer1',
      passwordHash: organizerPwd,
      firstName: 'Demo',
      lastName: 'Organizer',
      email: 'organizer@tedi.local',
      phone: '6900000001',
      address: 'Panepistimiou 1',
      city: 'Athens',
      country: 'Greece',
      afm: '111111111',
      latitude: 37.9838,
      longitude: 23.7275,
      role: Role.USER,
      status: UserStatus.APPROVED,
    },
  });

  // Demo participant
  const partPwd = await bcrypt.hash('user123', 10);
  const participant = await prisma.user.upsert({
    where: { username: 'user1' },
    update: {},
    create: {
      username: 'user1',
      passwordHash: partPwd,
      firstName: 'Demo',
      lastName: 'User',
      email: 'user@tedi.local',
      phone: '6900000002',
      address: 'Stadiou 5',
      city: 'Athens',
      country: 'Greece',
      afm: '222222222',
      latitude: 37.98,
      longitude: 23.73,
      role: Role.USER,
      status: UserStatus.APPROVED,
    },
  });

  // Sample published event
  const existingEvent = await prisma.event.findFirst({ where: { title: 'Συναυλία Σύγχρονης Μουσικής' } });
  if (!existingEvent) {
    await prisma.event.create({
      data: {
        title: 'Συναυλία Σύγχρονης Μουσικής',
        eventType: 'Concert',
        venue: 'Θέατρο Πόλης',
        address: 'Λεωφόρος Κεντρική 25',
        city: 'Athens',
        country: 'Greece',
        latitude: 37.9838,
        longitude: 23.7275,
        startDateTime: new Date('2026-07-12T20:30:00'),
        endDateTime: new Date('2026-07-12T23:00:00'),
        capacity: 350,
        description: 'Βραδιά με έργα σύγχρονων δημιουργών και καλεσμένους μουσικούς.',
        status: EventStatus.PUBLISHED,
        organizerId: organizer.id,
        categories: { create: [{ name: 'Music' }, { name: 'Live Performance' }] },
        ticketTypes: {
          create: [
            { name: 'General Admission', price: 18.0, quantity: 250, available: 250 },
            { name: 'Student', price: 12.0, quantity: 100, available: 100 },
          ],
        },
      },
    });
  }

  console.log('Seeded:', { admin: admin.username, organizer: organizer.username, participant: participant.username });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
