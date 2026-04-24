# Database Specification (MVP)

Database design for the Hotel PMS MVP. Implemented in PostgreSQL with Prisma ORM. 17 tables organized across seven logical domains: authentication, master data, front office, food & beverage, housekeeping, accounting, and payment.

The source of truth for the schema itself is `prisma/schema.prisma`. This document describes the intent, relationships, and design decisions behind it.

---

## Entity Relationship Diagram

The ERD below shows all 17 entities and their relationships in crow's-foot notation. Render through [mermaid.live](https://mermaid.live) or any Mermaid-compatible viewer.

```mermaid
erDiagram
  USER ||--o{ USER_ROLE : "has"
  ROLE ||--o{ USER_ROLE : "assigned_to"
  USER ||--o{ HOUSEKEEPING_LOG : "performs"
  USER ||--o{ NIGHT_AUDIT : "runs"
  USER ||--o{ PAYMENT : "receives"
  USER ||--o{ RESERVATION : "creates"
  USER ||--o{ FB_ORDER : "waits"
  USER ||--o{ FOLIO_LINE_ITEM : "posts"

  ROOM_TYPE ||--o{ ROOM : "categorizes"
  ROOM_TYPE ||--o{ RESERVATION : "requested_for"

  ROOM ||--o{ HOUSEKEEPING_LOG : "tracks"
  ROOM ||--o{ RESERVATION : "assigned_to"

  GUEST ||--o{ RESERVATION : "makes"
  RESERVATION ||--o| FOLIO : "opens"

  FOLIO ||--o{ FOLIO_LINE_ITEM : "contains"
  FOLIO ||--o{ PAYMENT : "settled_by"

  ARTICLE ||--o{ FOLIO_LINE_ITEM : "charged_as"

  MENU_ITEM ||--o{ FB_ORDER_ITEM : "ordered_as"
  FB_ORDER ||--o{ FB_ORDER_ITEM : "contains"
  FB_ORDER ||--o{ PAYMENT : "settled_by"
  FB_ORDER ||--o{ FOLIO_LINE_ITEM : "charged_to_room"

  USER {
    int id PK
    varchar username UK
    varchar password_hash
    varchar full_name
    boolean is_active
    timestamp created_at
  }
  ROLE {
    int id PK
    varchar code UK
    varchar name
    json permissions
  }
  USER_ROLE {
    int user_id PK, FK
    int role_id PK, FK
  }
  ROOM_TYPE {
    int id PK
    varchar code UK
    varchar name
    int capacity
    decimal base_rate
  }
  ROOM {
    int id PK
    varchar number UK
    int floor
    int room_type_id FK
    varchar status
  }
  ARTICLE {
    int id PK
    varchar code UK
    varchar name
    varchar type
    decimal default_price
  }
  HOTEL_SETTINGS {
    int id PK
    varchar hotel_name
    decimal tax_percent
    decimal service_charge_percent
    varchar night_audit_time
  }
  GUEST {
    int id PK
    varchar full_name
    varchar id_number
    varchar phone
    varchar nationality
  }
  RESERVATION {
    int id PK
    varchar reservation_no UK
    int guest_id FK
    int room_type_id FK
    int room_id FK
    date arrival_date
    date departure_date
    varchar status
    decimal deposit
    decimal rate_amount
    timestamp grc_filled_at
    int created_by_id FK
  }
  FOLIO {
    int id PK
    varchar folio_no UK
    int reservation_id FK, UK
    varchar status
    timestamp opened_at
  }
  FOLIO_LINE_ITEM {
    int id PK
    int folio_id FK
    int article_id FK
    int fb_order_id FK
    decimal quantity
    decimal unit_price
    decimal amount
    timestamp posted_at
  }
  MENU_ITEM {
    int id PK
    varchar code UK
    varchar name
    varchar category
    decimal price
  }
  FB_ORDER {
    int id PK
    varchar order_no UK
    varchar table_no
    varchar status
    varchar payment_method
    int charged_folio_id FK
    decimal total
    int waited_by_id FK
  }
  FB_ORDER_ITEM {
    int id PK
    int fb_order_id FK
    int menu_item_id FK
    int quantity
    decimal unit_price
    decimal amount
  }
  HOUSEKEEPING_LOG {
    int id PK
    int room_id FK
    varchar old_status
    varchar new_status
    int updated_by_id FK
    timestamp updated_at
  }
  NIGHT_AUDIT {
    int id PK
    date business_date UK
    int run_by_id FK
    timestamp run_at
    varchar status
    decimal total_revenue
    json report_data
  }
  PAYMENT {
    int id PK
    decimal amount
    varchar method
    int folio_id FK
    int fb_order_id FK
    int received_by_id FK
    timestamp received_at
  }
```

---

## Relational schema

Notation: `TableName(*pk*, *fk\#*, attr1, attr2, ...)`. Attributes marked with `*` are primary keys; those marked with `\#` are foreign keys.

**Authentication**

1. User(*id*, username, email, password_hash, full_name, is_active, created_at, updated_at)
2. Role(*id*, code, name, permissions)
3. UserRole(*user_id\#*, *role_id\#*, assigned_at)

**Master data**

4. RoomType(*id*, code, name, description, capacity, base_rate)
5. Room(*id*, number, floor, *room_type_id\#*, status)
6. Article(*id*, code, name, type, default_price)
7. HotelSettings(*id*, hotel_name, address, tax_percent, service_charge_percent, night_audit_time, currency)

**Front Office**

8. Guest(*id*, full_name, id_number, phone, email, address, nationality)
9. Reservation(*id*, reservation_no, *guest_id\#*, *room_type_id\#*, *room_id\#*, *created_by_id\#*, arrival_date, departure_date, adults, children, status, deposit, rate_amount, notes, grc_filled_at, grc_purpose_of_visit, created_at, updated_at)
10. Folio(*id*, folio_no, *reservation_id\#*, status, opened_at, closed_at)
11. FolioLineItem(*id*, *folio_id\#*, *article_id\#*, *fb_order_id\#*, *posted_by_id\#*, description, quantity, unit_price, amount, posted_at)

**Food & Beverage**

12. MenuItem(*id*, code, name, category, price, is_active)
13. FBOrder(*id*, order_no, *charged_folio_id\#*, *waited_by_id\#*, table_no, status, payment_method, subtotal, service_charge, tax, total, opened_at, closed_at)
14. FBOrderItem(*id*, *fb_order_id\#*, *menu_item_id\#*, quantity, unit_price, amount, notes)

**Housekeeping**

15. HousekeepingLog(*id*, *room_id\#*, *updated_by_id\#*, old_status, new_status, note, updated_at)

**Accounting**

16. NightAudit(*id*, business_date, *run_by_id\#*, run_at, status, total_revenue, occupancy_rate, report_data)

**Payment**

17. Payment(*id*, *folio_id\#*, *fb_order_id\#*, *received_by_id\#*, amount, method, reference, received_at)

---

## Design decisions

A few choices worth explaining:

1. **Rate is inlined into RoomType.** In the MVP, each room type has a single fixed rate (`base_rate`). Dynamic rate plans with date validity and guest segmentation are deferred.
2. **Guest Registration Card (GRC) is inlined into Reservation.** The `grc_filled_at` and `grc_purpose_of_visit` fields live directly on Reservation because the relationship is at-most-one-to-one and GRC filling happens at check-in.
3. **Rate snapshot on Reservation.** The `rate_amount` column captures the rate at booking time, so later changes to `base_rate` don't affect existing reservations.
4. **Payment is polymorphic.** Exactly one of `folio_id` or `fb_order_id` must be populated per Payment row. Enforced at the database level (CHECK constraint) or in the application layer.
5. **Room.status is denormalized.** Current room status lives directly on the Room table to keep the Tape Chart read fast. HousekeepingLog is the audit trail of every status change.
6. **F&B charges appear as folio line items.** When an F&B bill is charge-to-room, a FolioLineItem row is created with `fb_order_id` populated, preserving the link between the folio and the originating F&B order.

---

## Table specifications

### `user`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Unique user identifier |
| username | VARCHAR(50) | UNIQUE, NOT NULL | Login username |
| email | VARCHAR(100) | UNIQUE | User email |
| password_hash | VARCHAR(255) | NOT NULL | Password hash (bcrypt) |
| full_name | VARCHAR(100) | NOT NULL | User's full name |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Account active status |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Account creation time |
| updated_at | TIMESTAMP | NOT NULL | Last update time |

### `role`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Unique role identifier |
| code | VARCHAR(20) | UNIQUE, NOT NULL | Role code (FO, HK, FB, ACC, ADMIN) |
| name | VARCHAR(50) | NOT NULL | Role name |
| permissions | JSONB | NOT NULL | Per-module permission map |

### `user_role`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| user_id | INT | PRIMARY KEY, FOREIGN KEY → user(id) | User reference |
| role_id | INT | PRIMARY KEY, FOREIGN KEY → role(id) | Role reference |
| assigned_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Role assignment time |

### `room_type`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Unique room type identifier |
| code | VARCHAR(20) | UNIQUE, NOT NULL | Type code (STD, DLX, SUP) |
| name | VARCHAR(50) | NOT NULL | Room type name |
| description | TEXT | — | Description |
| capacity | INT | NOT NULL | Max guest capacity |
| base_rate | DECIMAL(12,2) | NOT NULL | Base rate per night |

### `room`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Unique room identifier |
| number | VARCHAR(10) | UNIQUE, NOT NULL | Room number |
| floor | INT | NOT NULL | Floor number |
| room_type_id | INT | FOREIGN KEY → room_type(id) | Room type reference |
| status | VARCHAR(10) | NOT NULL, DEFAULT 'VC' | Room status (VC, VD, OC, OD, OOO) |

### `article`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Unique article identifier |
| code | VARCHAR(20) | UNIQUE, NOT NULL | Charge code |
| name | VARCHAR(100) | NOT NULL | Charge name |
| type | VARCHAR(20) | NOT NULL | Type (ROOM, FB, SERVICE, TAX, MISC) |
| default_price | DECIMAL(12,2) | — | Default price (optional) |

### `hotel_settings`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| id | INT | PRIMARY KEY, DEFAULT 1 | Singleton (always one row) |
| hotel_name | VARCHAR(100) | NOT NULL | Hotel name |
| address | TEXT | — | Hotel address |
| tax_percent | DECIMAL(5,2) | NOT NULL | Tax percentage |
| service_charge_percent | DECIMAL(5,2) | NOT NULL | Service charge percentage |
| night_audit_time | VARCHAR(5) | NOT NULL | Night audit cutoff (HH:MM) |
| currency | VARCHAR(5) | NOT NULL, DEFAULT 'IDR' | System currency |

### `guest`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Unique guest identifier |
| full_name | VARCHAR(100) | NOT NULL | Guest's full name |
| id_number | VARCHAR(50) | — | ID card / passport number |
| phone | VARCHAR(20) | — | Phone number |
| email | VARCHAR(100) | — | Email |
| address | TEXT | — | Address |
| nationality | VARCHAR(50) | — | Nationality |

### `reservation`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Unique reservation identifier |
| reservation_no | VARCHAR(20) | UNIQUE, NOT NULL | Reservation number |
| guest_id | INT | FOREIGN KEY → guest(id) | Booking guest |
| room_type_id | INT | FOREIGN KEY → room_type(id) | Room type booked |
| room_id | INT | FOREIGN KEY → room(id) | Physical room assigned at check-in |
| arrival_date | DATE | NOT NULL | Planned check-in date |
| departure_date | DATE | NOT NULL | Planned check-out date |
| adults | INT | NOT NULL, DEFAULT 1 | Number of adults |
| children | INT | NOT NULL, DEFAULT 0 | Number of children |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'CONFIRMED' | CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW |
| deposit | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | Deposit paid |
| rate_amount | DECIMAL(12,2) | NOT NULL | Rate snapshot at booking time |
| notes | TEXT | — | Reservation notes |
| grc_filled_at | TIMESTAMP | — | GRC completion time |
| grc_purpose_of_visit | VARCHAR(100) | — | Purpose of visit (GRC field) |
| created_by_id | INT | FOREIGN KEY → user(id) | Staff who created the reservation |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Creation time |
| updated_at | TIMESTAMP | NOT NULL | Last update time |

### `folio`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Unique folio identifier |
| folio_no | VARCHAR(20) | UNIQUE, NOT NULL | Folio number |
| reservation_id | INT | UNIQUE, FOREIGN KEY → reservation(id) | Associated reservation |
| status | VARCHAR(10) | NOT NULL, DEFAULT 'OPEN' | OPEN, CLOSED, VOIDED |
| opened_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Folio opened time |
| closed_at | TIMESTAMP | — | Folio closed time |

### `folio_line_item`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Unique line item identifier |
| folio_id | INT | FOREIGN KEY → folio(id) | Target folio |
| article_id | INT | FOREIGN KEY → article(id) | Article (charge code) |
| fb_order_id | INT | FOREIGN KEY → fb_order(id) | F&B order (if charge to room) |
| description | VARCHAR(255) | NOT NULL | Item description |
| quantity | DECIMAL(8,2) | NOT NULL, DEFAULT 1 | Quantity |
| unit_price | DECIMAL(12,2) | NOT NULL | Unit price |
| amount | DECIMAL(12,2) | NOT NULL | Total (quantity × unit_price) |
| posted_by_id | INT | FOREIGN KEY → user(id) | Posting staff |
| posted_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Posting time |

### `menu_item`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Unique menu item identifier |
| code | VARCHAR(20) | UNIQUE, NOT NULL | Menu code |
| name | VARCHAR(100) | NOT NULL | Menu name |
| category | VARCHAR(50) | NOT NULL | Category (Main, Beverage, Dessert, etc.) |
| price | DECIMAL(12,2) | NOT NULL | Selling price |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Active status |

### `fb_order`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Unique order identifier |
| order_no | VARCHAR(20) | UNIQUE, NOT NULL | Order number |
| table_no | VARCHAR(10) | — | Table number |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'OPEN' | OPEN, BILLED, CLOSED, VOIDED |
| payment_method | VARCHAR(20) | — | CASH, CHARGE_TO_ROOM (set at billing) |
| charged_folio_id | INT | FOREIGN KEY → folio(id) | Target folio for charge-to-room |
| subtotal | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | Subtotal before SC and tax |
| service_charge | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | Service charge |
| tax | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | Tax |
| total | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | Total payable |
| waited_by_id | INT | FOREIGN KEY → user(id) | Serving waiter |
| opened_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Order opened time |
| closed_at | TIMESTAMP | — | Order closed time |

### `fb_order_item`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Unique item identifier |
| fb_order_id | INT | FOREIGN KEY → fb_order(id) | Containing order |
| menu_item_id | INT | FOREIGN KEY → menu_item(id) | Menu item ordered |
| quantity | INT | NOT NULL | Quantity |
| unit_price | DECIMAL(12,2) | NOT NULL | Unit price at order time |
| amount | DECIMAL(12,2) | NOT NULL | Total |
| notes | VARCHAR(255) | — | Kitchen notes |

### `housekeeping_log`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Unique log identifier |
| room_id | INT | FOREIGN KEY → room(id) | Updated room |
| old_status | VARCHAR(10) | NOT NULL | Status before update |
| new_status | VARCHAR(10) | NOT NULL | Status after update |
| note | TEXT | — | Staff note |
| updated_by_id | INT | FOREIGN KEY → user(id) | HK staff who updated |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Update time |

### `night_audit`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Unique night audit identifier |
| business_date | DATE | UNIQUE, NOT NULL | Business date closed |
| run_by_id | INT | FOREIGN KEY → user(id) | Night auditor |
| run_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Execution time |
| status | VARCHAR(20) | NOT NULL | PENDING, RUNNING, COMPLETED, FAILED |
| total_revenue | DECIMAL(14,2) | — | Total revenue for the day |
| occupancy_rate | DECIMAL(5,2) | — | Occupancy rate (%) |
| report_data | JSONB | — | Snapshot data for the night report |

### `payment`

| Attribute | Type | Constraint | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Unique payment identifier |
| amount | DECIMAL(12,2) | NOT NULL | Payment amount |
| method | VARCHAR(20) | NOT NULL | CASH, TRANSFER, CARD, CHARGE_TO_ROOM |
| reference | VARCHAR(100) | — | Reference number (bank ref, card last 4) |
| folio_id | INT | FOREIGN KEY → folio(id) | Folio paid (optional) |
| fb_order_id | INT | FOREIGN KEY → fb_order(id) | F&B order paid (optional) |
| received_by_id | INT | FOREIGN KEY → user(id) | Receiving staff |
| received_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Payment time |

> **Polymorphic constraint on Payment**: exactly one of `folio_id` or `fb_order_id` must be populated.