# 💰 BudgetIQ — Personal Budget Tracker

A full-stack personal finance tracker with an **Express.js REST API** backend backed by **SQLite** (via `better-sqlite3`), and a clean vanilla-HTML/CSS/JS frontend.

---

## 🗄️ DBMS Concepts Used

| Concept | Where Used |
|---|---|
| **DDL** — `CREATE TABLE`, `CREATE INDEX` | `db/schema.sql` |
| **DML** — `INSERT`, `UPDATE`, `DELETE` | `routes/transactions.js` |
| **Constraints** — `NOT NULL`, `UNIQUE`, `CHECK` | `db/schema.sql` |
| **Foreign Keys** — `ON DELETE CASCADE / RESTRICT` | `transactions → users`, `transactions → categories` |
| **Indexes** — on `user_id`, `type`, `txn_date`, `category_id` | `db/schema.sql` |
| **Parameterised Queries** — prevent SQL injection | All routes |
| **JOIN** — `transactions ⟕ categories` | `routes/transactions.js`, `routes/summary.js` |
| **Aggregate Functions** — `SUM()`, `COUNT()`, `ROUND()` | `routes/summary.js` |
| **Conditional Aggregation** — `CASE WHEN type='income' THEN…` | `GET /api/summary/overview` |
| **GROUP BY + ORDER BY** | `GET /api/summary/by-category` |
| **Date Functions** — `strftime('%Y-%m', txn_date)` | `GET /api/summary/monthly` |
| **Pagination** — `LIMIT` + `OFFSET` | `GET /api/transactions` |
| **Transactions** — `db.transaction(fn)` | Seed data bulk insert |
| **Normalisation** — Separate `categories` lookup table | `db/schema.sql` |

---

## 📁 Project Structure

```
Personal Budget tracker/
├── budget_tracker.html          ← Frontend (connects to backend API)
└── backend/
    ├── server.js                ← Express app entry point
    ├── config.js                ← Port, JWT config
    ├── package.json
    ├── db/
    │   ├── schema.sql           ← DDL: tables, indexes, seed data
    │   ├── database.js          ← SQLite connection + schema runner
    │   └── budgetiq.db          ← SQLite file (auto-created on first run)
    ├── middleware/
    │   └── auth.js              ← JWT verification middleware
    └── routes/
        ├── auth.js              ← Login / logout / /me
        ├── transactions.js      ← Full CRUD for transactions
        ├── summary.js           ← Dashboard analytics queries
        └── categories.js        ← Category list
```

---

## 🚀 Getting Started

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Start the server
```bash
npm start
# or for development with auto-restart:
npm run dev
```

### 3. Open the app
```
http://localhost:5000/budget_tracker.html
```
Login with: **admin / 1234**

---

## 🔌 REST API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Login, returns JWT |
| `GET`  | `/api/auth/me` | Get current user |
| `POST` | `/api/auth/logout` | Logout (stateless) |

### Transactions
| Method | Endpoint | Description |
|---|---|---|
| `GET`    | `/api/transactions` | List all (filters + pagination) |
| `POST`   | `/api/transactions` | Create new |
| `GET`    | `/api/transactions/:id` | Get one |
| `PUT`    | `/api/transactions/:id` | Update |
| `DELETE` | `/api/transactions/:id` | Delete |

**Query params for GET /api/transactions:**
`?type=income|expense  &category=Food  &search=...  &from=YYYY-MM-DD  &to=YYYY-MM-DD  &page=1  &limit=20`

### Summary / Analytics
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/summary/overview` | Total income, expense, balance, savings rate |
| `GET` | `/api/summary/by-category` | Expense per category with % share |
| `GET` | `/api/summary/monthly` | Last 6 months income vs expense |
| `GET` | `/api/summary/recent` | Latest N transactions |

### Categories
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/categories` | All categories |
| `GET` | `/api/categories?type=income` | Filtered by type |

---

## 🔐 Authentication Flow

1. `POST /api/auth/login` with `{ username, password }` → receive JWT
2. Include header `Authorization: Bearer <token>` on every protected request
3. Token expires in 7 days

---

## 🗃️ Database Schema (ER Diagram)

```
users              categories
──────             ──────────
id (PK)            id (PK)
username           name (UNIQUE)
password_hash      type (income|expense|both)
display_name
created_at

transactions
────────────────────────────
id (PK)
user_id     → FK → users.id      (CASCADE DELETE)
category_id → FK → categories.id (RESTRICT DELETE)
type        CHECK('income','expense')
description
amount      CHECK(> 0)
txn_date
note
created_at
updated_at
```
