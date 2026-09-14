# Room blocks — issue #213 Phase 2

## Consumer contracts

- `actions.ts`: `createRoomBlockAction(input: unknown)` and
  `releaseRoomBlockAction(input: unknown)` return `Promise<RoomBlockActionResult>`.
  Both accept a plain object or `FormData`, authenticate FO/ADMIN, validate transport
  input, and revalidate only after commit. UI must check `result.ok`.
- `schema.ts`: `CreateRoomBlockInput` is `{ roomId: number | string;
  startDate: string; endDate: string; reason?: RoomBlockReason; note?: string }`.
  Reason defaults to `MAINTENANCE`; note is trimmed and limited to 2,000 characters.
  `ReleaseRoomBlockInput` is `{ blockId: number | string }`.
- `errors.ts`: `RoomBlockActionResult` succeeds with `{ ok: true; blockId: number;
  roomId: number; alreadyReleased?: boolean }`, or fails with `{ ok: false;
  code: RoomBlockFailureCode; error: string; field?: string }`.
  `alreadyReleased` is supplied by release, including idempotent retries.
- `queries.ts`: `getActiveRoomBlocks(input?: ActiveRoomBlocksInput, db?)` returns
  `Promise<RoomBlockSummary[]>`. Filters are optional `roomId`, `roomTypeId`, and
  `range: RoomBlockDateRange`. No range means all active blocks, supporting local
  date changes in the reservation form. `db` defaults to Prisma; authoritative
  mutation checks must pass their transaction client.
- `queries.ts`: `detectRoomBlockReservationConflicts({ roomId, range }, db?)`
  returns `Promise<RoomBlockReservationConflict[]>`: ID, reservation number, and
  arrival/departure `Date` values. Only `CONFIRMED` and `CHECKED_IN` count.
- `overlap.ts` is client-safe: `RoomBlockDateRange` contains hotel-calendar ISO
  strings `{ startDate, endDate }`; `RoomBlockSummary` adds `id`, `roomId`,
  `reason`, and `status`. `overlapsDateRange`, `findOverlappingRoomBlock`,
  `ROOM_BLOCK_REASON_LABELS`, and `roomBlockedMessage` share availability/copy.
- `../reservation-capacity-logic.ts`: `computeDailyRoomTypeCapacity` accepts one
  room type's inventory, active reservations, and blocks, and returns
  `DailyRoomTypeCapacity[]` (`date`, `roomCount`, `reservationCount`,
  `blockedCount`, `available`). Each blocked room is counted once per night.

All query ranges must contain valid `YYYY-MM-DD` hotel dates with start < end.
Ranges are half-open: a stay ending when a block starts, or beginning when a block
ends, does not overlap. Released blocks do not affect availability.

## Transaction ownership

`operations.ts` owns complete create/release transitions, including serializable
transactions, bounded retries, room locks, authoritative reads, conditional writes,
and HK logs. These are internal server operations, not client-callable actions.
Never expose their individual writes or invoke them with a pre-read entity.

Lock ordering follows reservation allocation: room first, room-type capacity
second. Multi-room creation locks assigned room IDs in ascending order. A room lock
serializes same-room allocation/block writes; serializable predicate reads and
retries protect cross-room capacity, including unallocated reservations. A failed
capacity check after block insertion throws, rolling back that insertion. Release
re-reads block state after locating/locking the room and compare-and-sets ACTIVE to
RELEASED. Concurrent operations must retry the entire transaction.

Create sets OOO and logs the transition only when the block covers hotel today.
Before setting OOO, the locked transaction rejects any started-but-unfinished
cleaning session (including earlier dates) with the same message as HK's status
override guard. Both physical OOO/VD transitions separately reject any CHECKED_IN
reservation for the room, regardless of arrival/departure dates: inventory overlap
is not proof that a guest has checked out. These failures throw and roll back the
entire block create/release operation (`CLEANING_IN_PROGRESS` / `ROOM_OCCUPIED`).

Release changes OOO to VD and logs it only when the released block has already
started (`startDate <= hotel today`) and no other active block covers today. This
allows explicit release of an expired block, but releasing an unrelated future
block never clears current OOO. No historical OOO ownership or backfill dates are
inferred. An already released block is an idempotent no-op. Future/expired blocks alone do
not mark a room OOO on creation. Automatic day-boundary status synchronization is
not part of Phase 2; availability is always derived from dated blocks, not OOO.

## Integration and migration caveat

Reservation create/edit, dropdown options, and check-in readiness/transaction
checks use dated blocks. Allocation errors return `ROOM_BLOCKED` with Indonesian
reason/date copy. Existing `ROOM_OOO` error constants remain for compatibility but
no longer gate these flows. Money/deposit/signature operations remain canonical.

A legacy OOO room with no active dated block is bookable. Schema migration alone
does not turn legacy OOO statuses into blocks; ensure real outages have block data
before rollout. The live DB inspected during this implementation had no active
blocks and room 108 still marked OOO. No seed/reset or data backfill was run.

Tape chart, navigation, management UI, and HK override ownership are later phases
and remain untouched. HK owners should review the new transaction-owned status
logs. Unit tests cover operation/error paths using transaction doubles; they are
not evidence of PostgreSQL race behavior. Review serializable/lock reasoning and
use a dedicated safe TEST_DATABASE_URL for DB-backed concurrency validation.
