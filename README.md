# StratePage — High-Performance Consistent Pagination

StratePage is a high-performance web application demonstrating how to solve the classic database pagination problem under active concurrent writes. 

A naive `LIMIT / OFFSET` pagination scheme degrades to $O(N)$ performance at high page numbers and suffers from consistency bugs (duplicates or skipped items) when new items are inserted or updated while a user is actively browsing. StratePage solves both problems using **Keyset (Cursor) Pagination ($O(\log N)$)** combined with **Session Snapshot Isolation**, running against a **Supabase (PostgreSQL)** database.

This project features a **Node.js + Express + TypeScript** backend (functional design), a **Supabase (PostgreSQL)** database with optimized composite indexes, a high-performance seeding script (inserts 200,000 rows in seconds), and an interactive **React + Vite + Tailwind CSS v3** frontend styled in a premium **Green Leaf & Coffee Glassmorphism** theme.

---

## 📝 Short Note & Reflection (Project Submission Details)

### 1. What We Chose & Why
* **Backend**: **Node.js + Express + TypeScript** using a **purely functional design** (direct function exports instead of class bloat). This stack is lightweight, extremely fast, type-safe, and deploys easily on free-tier web services.
* **Database**: **Supabase (PostgreSQL)**. PostgreSQL is the gold standard for relational indexing and supports complex keyset comparisons natively. Supabase provides an excellent, fast serverless PostgreSQL instance with zero credit card required.
* **ORM/Driver**: **Raw `pg` (node-postgres)**. We intentionally skipped heavy ORMs like Prisma or TypeORM. Operating directly with the database driver allows **100% control over the SQL queries, index scans, and parameterization**, ensuring maximum execution speed and zero ORM mapping overhead.
* **Frontend**: **React + Vite + Tailwind CSS v3**. React allows us to elegantly manage complex UI state (infinite scroll, active cursor, session snapshot, and concurrent write logs). Vite provides instant hot-reloads, and Tailwind enables rapid, highly tailored styling.

### 2. What We'd Improve with More Time
* **Redis-Backed Snapshotting**: Currently, the session `snapshot` timestamp is maintained by the client and sent as a query parameter. With more time, we would store active browsing session tokens in an in-memory **Redis cache** on the server, mapping session IDs to frozen timestamps for enhanced security and abstraction.
* **Connection Pool Fine-Tuning**: Implement a dedicated pooler setup utilizing Supabase's transaction pooler (port 6543) with prepared statements disabled in the driver configurations, maximizing concurrent connection limits under heavy traffic.
* **Load Testing (k6)**: Write a load testing suite using **k6** to benchmark and stress-test the keyset query latency under a simulated load of thousands of concurrent users scrolling through the 200,000 products.
* **Offline Synchronization**: Implement client-side caching (e.g., indexedDB) to allow smooth offline browsing of loaded pages.

### 3. How We Used AI
* **How it helped**: The AI assistant scaffolded the TypeScript projects, wrote the high-performance bulk-insert SQL generator, established the staggered unique timestamp logic, implemented the Intersection Observer infinite scroll hook, and styled a custom-tailored glassmorphic user interface.
* **Bugs caught & resolved**:
  1. *TypeScript Strict Unused Imports*: The compiler flagged unused imports (`React`, `Filter`, `DollarSign`, `Tag`) in the React template, preventing production builds. We refactored `App.tsx` to remove them.
  2. *Connection Handshake Timeouts*: Under remote network latency to Singapore, the database pool occasionally exceeded the default 2-second connection timeout during initial handshakes. We resolved this by increasing `connectionTimeoutMillis` to 10 seconds.
  3. *Special Character Password Parsing*: The database password contained a `$` character, which broke connection string URL parsing. We resolved this by URL-encoding the password (`%24`) and helping reset the database password to ensure stable authentication.

---

## 🚀 Core Engineering Solutions

### 1. Keyset (Cursor) Pagination
Instead of scanning and skipping a numerical offset of rows, we utilize a composite cursor of `(updated_at, id)` based on our sort order (`updated_at DESC, id DESC`).
To fetch the next page, the database queries:
```sql
SELECT *
FROM products
WHERE (
  updated_at < :cursor_updated_at 
  OR (updated_at = :cursor_updated_at AND id < :cursor_id)
)
ORDER BY updated_at DESC, id DESC
LIMIT :limit;
```
* **Performance ($O(\log N)$)**: The query directly seeks into the database index tree.
* **Resilience**: Inserting new items at the top of the feed does not shift the index offset of items below the cursor, preventing duplicates when users cross page boundaries.

### 2. Session Snapshot Isolation
While keyset pagination handles *new insertions at the top* perfectly, it is still vulnerable to **updates on existing products** (which updates their `updated_at` and shifts them to the top of the list) or **historical insertions**. When these happen, items shift, causing duplicates or skipped records in an active pagination stream.

StratePage solves this by capturing a `snapshot` timestamp when the user requests the **first page**:
1. On page 1, the backend establishes a snapshot time (e.g., `NOW()`) and returns it to the client.
2. For all subsequent pages, the client sends this `snapshot` timestamp back.
3. The server adds the filter: `updated_at <= :snapshot`.

This effectively "freezes" the browsing session. Any write occurring after the session started (`updated_at > snapshot`) is ignored, ensuring a stable, duplicate-free, and gap-free reading flow.

### 3. Optimized Database Indexing
Without appropriate indexes, pagination queries would force full-table scans, causing database performance to collapse at 200,000+ rows. We define two high-performance composite indexes:
```sql
-- For global pagination (newest first)
CREATE INDEX idx_products_updated_id ON products (updated_at DESC, id DESC);

-- For category-filtered pagination (newest first)
CREATE INDEX idx_products_category_updated_id ON products (category, updated_at DESC, id DESC);
```
These allow PostgreSQL to perform fast **Index Scan / Index Only Scan** operations, returning results in sub-millisecond times.

---

## 🎨 Design Theme: Green Leaf & Coffee Glassmorphism

The frontend is styled in a custom, highly polished **Green Leaf & Coffee Glassmorphism** theme to create an organic, premium visual experience:
* **Espresso Backdrop**: A warm, deep roasted-coffee backdrop (`bg-stone-950`) with two fixed radial glowing spotlights—a fresh leaf-green (`bg-emerald-500/5`) in the top left, and a warm caramel (`bg-amber-500/5`) in the bottom right—giving the application immense visual depth.
* **Coffee Glass Panels**: Containers (`.glass-panel`) and cards (`.glass-card`) feature a warm espresso tint, heavy backdrop blur filters, and thin emerald borders. On hover, cards transition smoothly with a dual caramel and emerald glow.
* **Leaf Green & Caramel Accents**: Action buttons, active navigation pills, progress logs, and scrollbars are accented in organic emerald-greens (`bg-emerald-600`), while prices, transaction query labels, and timestamps are highlighted in rich, warm caramels (`text-amber-400`).

---

## 🧪 Verification & Test Logs

We have successfully connected to the live Supabase database and run all verification steps.

### 1. Database Seeding
The seeding script successfully connected, verified the DDL schema, truncated the table, and inserted **200,000 products** with staggered timestamps in **37 seconds**:
```bash
> pagination-backend@1.0.0 seed
> tsx src/scripts/seed.ts

Starting high-performance seeding script...
Initializing database schema...
Database schema initialized (tables and indexes verified).
Truncating existing products...
Generating and inserting 200000 products in 40 batches...
Seeding progress: 25% (50000/200000 products inserted)
Seeding progress: 50% (100000/200000 products inserted)
Seeding progress: 75% (150000/200000 products inserted)
Seeding progress: 100% (200000/200000 products inserted)
Seeding completed successfully in 37.62 seconds.
Verified total products in database: 200000
```

### 2. Automated Concurrency Integration Test
The concurrency test script successfully executed 10 full pages of pagination, simulated 50 writes (25 inserts and 25 updates) mid-scroll, and verified that **every consistency assertion passed perfectly**:
```bash
> pagination-backend@1.0.0 test:concurrency
> tsx src/scripts/test-concurrency.ts

===================================================
🧪 RUNNING CONCURRENCY & PAGINATION CONSISTENCY TEST
===================================================
Step 1: Requesting Page 1...
✅ Page 1 Loaded: Received 20 products.
🔒 Snapshot isolation established at: 2026-06-24T07:09:00.314Z
🎫 Next Cursor: eyJ1cGRhdGVkQXQ...

Step 2: Simulating 50 concurrent writes (25 inserts, 25 updates)...
⚡ Background writes completed in DB.
   - New items inserted: 25
   - Existing items updated: 25

Step 3: Paginating through subsequent pages using the locked snapshot...
   - Page 2 loaded: 20 products (Cursor: eyJ1cGRhdG...)
   - Page 3 loaded: 20 products (Cursor: eyJ1cGRhdG...)
   - Page 4 loaded: 20 products (Cursor: eyJ1cGRhdG...)
   - Page 5 loaded: 20 products (Cursor: eyJ1cGRhdG...)
   - Page 6 loaded: 20 products (Cursor: eyJ1cGRhdG...)
   - Page 7 loaded: 20 products (Cursor: eyJ1cGRhdG...)
   - Page 8 loaded: 20 products (Cursor: eyJ1cGRhdG...)
   - Page 9 loaded: 20 products (Cursor: eyJ1cGRhdG...)
   - Page 10 loaded: 20 products (Cursor: eyJ1cGRhdG...)

===================================================
📊 TEST RESULTS SUMMARY
===================================================
Total products loaded: 200
Duplicates detected:   0
Snapshot violations:   0
✅ PASS: Zero duplicates detected across all paginated pages.
✅ PASS: Zero snapshot violations. Newer background inserts were successfully isolated.
✅ PASS: Keyset sort order (updated_at DESC, id DESC) is perfectly consistent.

🎉 ALL CONCURRENCY AND PAGINATION TESTS PASSED SUCCESFULLY!
===================================================
```

---

## 📂 Project Directory Structure

```
PaginationTask/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── postgres.ts            # Database pool (pg) & DDL runner
│   │   │   └── schema.sql             # Table & index SQL definitions
│   │   ├── controllers/
│   │   │   └── product.controller.ts  # Express middleware functions
│   │   ├── services/
│   │   │   └── product.service.ts     # Business logic & cursor/snapshot management
│   │   ├── repositories/
│   │   │   └── product.repository.ts  # Dynamic SQL repository functions
│   │   ├── routes/
│   │   │   └── product.routes.ts      # API routing
│   │   ├── types/
│   │   │   └── product.ts             # TypeScript type definitions
│   │   ├── scripts/
│   │   │   ├── seed.ts                # High-performance 200k seeder
│   │   │   └── test-concurrency.ts    # Concurrency integration test script
│   │   ├── app.ts                     # Express server configuration
│   │   └── server.ts                  # Server initialization entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
└── frontend/
    ├── src/
    │   ├── App.tsx                    # Consolidated themed UI dashboard
    │   ├── main.tsx
    │   └── index.css                  # Tailwind imports & custom glassmorphism
    ├── package.json
    ├── vite.config.ts                 # Dev server configuration with API proxy
    ├── tailwind.config.js
    ├── postcss.config.js
    └── tsconfig.json
```

---

## ⚡ Quick Start Guide

### 1. Environment Configuration
Create a `.env` file in the `backend/` folder:
```env
PORT=5000
DATABASE_URL=postgresql://postgres.[project-id]:[password]@[hostname]:5432/postgres
```

### 2. Run Seeding & Tests
Navigate to the `backend/` folder, install dependencies, seed 200k products, and run the concurrency tests:
```bash
cd backend
npm install
npm run seed
npm run test:concurrency
```

### 3. Start Development Servers
Start both servers locally:
* **Backend API** (`backend/` folder):
  ```bash
  npm run dev
  ```
  *Runs at `http://localhost:5000`*
* **Frontend UI** (`frontend/` folder):
  ```bash
  npm run dev
  ```
  *Runs at `http://localhost:3000`*

Open **`http://localhost:3000`** in your browser to experience the themed dashboard. Click **"Simulate 50 Writes"** to inject concurrent database updates, scroll through the infinite feed, toggle the **Snapshot Lock** to observe the logs, and verify consistency in real time.
