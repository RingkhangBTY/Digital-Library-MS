# Digital Library Management System

Express + Router backend wired to the existing catalog/member/admin pages, using in-memory dummy data (no database yet).

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000

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
data/                   → dummy in-memory "database" modules
  books.js, users.js, loans.js
public/                 → static frontend (unchanged page structure)
  index.html, member.html, admin.html, style.css
```

## How access is gated

- **Catalog (`index.html`)** — open to everyone, no login. Reserving a book requires a member login.
- **Member Portal (`member.html`)** — name + password login (or register on the spot). Once logged in: borrow/return/pay fines/cancel reservations, all scoped to that member's own loans.
- **Admin Panel (`admin.html`)** — gated behind a separate librarian login. Once in: add/delete books, issue/return any loan, view all members and live analytics.

Sessions are cookie-based (`express-session`), stored server-side in memory. Restarting the server clears sessions and resets all dummy data back to its seeded state.

## Demo accounts

| Portal | Name | Password |
|---|---|---|
| Member | Ringkhang | member123 |
| Member | Riya | member123 |
| Member | Aman | member123 |
| Admin | Head Librarian | admin123 |

`Riya` starts with an overdue copy of *1984* (fine accruing). `Ringkhang` starts with a *Clean Code* reservation ready for pickup, plus two items in borrowing history.

## Notes for next steps

- Swap the `data/*.js` in-memory arrays for a real database — routes and controllers don't need to change, only the data layer.
- Passwords are hashed with a salted SHA-256 (Node's built-in `crypto`) to avoid an npm dependency for the MVP; swap for `bcrypt` when you add a real database.
