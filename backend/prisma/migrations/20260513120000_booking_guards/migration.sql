-- Defense-in-depth guards for the booking flow. The application enforces these
-- in the booking transaction (atomic conditional update), but DB-level
-- constraints make absolutely sure no concurrent path can leave stock negative
-- or oversell an event.

-- 1. No ticket-type may go below zero.
ALTER TABLE "TicketType"
  ADD CONSTRAINT "TicketType_available_nonneg" CHECK ("available" >= 0);

-- 2. "available" must never exceed "quantity" (sanity).
ALTER TABLE "TicketType"
  ADD CONSTRAINT "TicketType_available_le_quantity" CHECK ("available" <= "quantity");

-- 3. Quantity itself must be positive.
ALTER TABLE "TicketType"
  ADD CONSTRAINT "TicketType_quantity_positive" CHECK ("quantity" > 0);
