# Digital Library Management System

Express + Router backend wired to the existing catalog/member/admin pages, using MongoDB for persistent storage.

## Run it

```bash
npm install
cp .env.example .env
npm run dev
```

Then open http://localhost:3000

For Render deployment, set these environment variables in the Render dashboard:

```bash
NODE_ENV=production
PORT=3000
MONGODB_URI=<your-mongodb-connection-string>
MONGODB_DB_NAME=digital_library_ms
SESSION_SECRET=<a-strong-random-secret>
```

## Structure

```
server.js              → app entry point, mounts all routers
routes/                → express.Router() per resource
  authRoutes.js         (member + librarian login/register/logout)
  bookRoutes.js         (catalog CRUD — public reads, librarian writes)
  loanRoutes.js         (reserve, issue, return, pay fine)
  memberRoutes.js       (librarian-only member list)
  analyticsRoutes.js    (admin dashboard stats)
middleware/auth.js      → requireMember / requireLibrarian session guards
data/                   → MongoDB data access modules
  books.js, users.js, loans.js
public/                 → static frontend (unchanged page structure)
  index.html, member.html, admin.html, style.css
```

## How access is gated

- **Catalog (`index.html`)** — open to everyone, no login. Reserving a book requires a member login.
- **Member Portal (`member.html`)** — name + password login (or register on the spot). Once logged in: borrow/return/pay fines/cancel reservations, all scoped to that member's own loans.
- **Admin Panel (`admin.html`)** — gated behind a separate librarian login. Once in: add/delete books, issue/return any loan, view all members and live analytics.

Sessions are cookie-based (`express-session`), stored server-side in memory. Restarting the server clears sessions, but library records remain persisted in MongoDB.

Configure environment variables in `.env`:

```bash
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.8.3
MONGODB_DB_NAME=digital_library_ms
SESSION_SECRET=replace-with-a-strong-random-secret
```

The application no longer seeds predefined books, users, librarians, or loans at startup. Manage all records directly in your MongoDB database.

## Environment variables (additional)

- MAX_BORROW (optional): Maximum simultaneous active loans per member (default: 5).
- MAX_RENEWALS (optional): Maximum number of renewals per loan (default: 2).
- MAINTENANCE_TOKEN (optional): An opaque token used to secure scheduled maintenance endpoints (used by host cron jobs). If set, you can call the maintenance endpoint using the token instead of a librarian session.

## Scheduling background maintenance (Render example)

To run daily recalculation of overdue statuses and fines, configure a scheduled job in your host to POST to the maintenance endpoint. Example (Render scheduled job):

- Command to run (Render cron job):

  curl -X POST "https://<your-app>.onrender.com/api/loans/recalculate?token=<MAINTENANCE_TOKEN>"

If you do not wish to use MAINTENANCE_TOKEN, the endpoint can also be triggered by an authenticated librarian session via POST /api/loans/recalculate.

## Notifications, payments, and audit APIs

- Member notifications (session required):
  - `GET /api/notifications/mine`
  - `POST /api/notifications/mine/read-all`
- Admin/librarian operational APIs:
  - `GET /api/loans/payments` (recent fine payment history)
  - `GET /api/loans/audit-logs` (recent audit entries)

## Notes for next steps

- Passwords are hashed with a salted SHA-256 (Node's built-in `crypto`); for production, prefer `bcrypt` or `argon2`.
