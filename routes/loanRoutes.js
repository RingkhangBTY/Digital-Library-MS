const express = require("express");
const router = express.Router();
const loans = require("../data/loans");
const books = require("../data/books");
const users = require("../data/users");
const audit = require("../data/audit");
const { requireMember, requireLibrarian } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/asyncHandler");

async function enrich(loan) {
  const [book, member] = await Promise.all([
    books.getById(loan.bookId),
    users.getMemberById(loan.memberId)
  ]);
  return {
    ...loan,
    bookTitle: book ? book.title : "Unknown book",
    bookAuthor: book ? book.author : "",
    memberName: member ? member.name : "Unknown member"
  };
}

// Member: reserve a book
router.post("/reserve", requireMember, asyncHandler(async (req, res) => {
  const { bookId } = req.body;
  const book = await books.getById(bookId);
  if (!book) return res.status(404).json({ error: "Book not found." });
  const loan = await loans.reserve({ bookId, memberId: req.session.member.id });
  res.status(201).json({ loan: await enrich(loan) });
}));

// Librarian: issue a book directly to a member
router.post("/issue", requireLibrarian, asyncHandler(async (req, res) => {
  const { bookId, memberId } = req.body;
  const book = await books.getById(bookId);
  if (!book) return res.status(404).json({ error: "Book not found." });
  if (!(await users.getMemberById(memberId))) return res.status(404).json({ error: "Member not found." });
  if (book.availableCopies <= 0) return res.status(409).json({ error: "No copies available to issue." });

  // enforce borrow limit
  const maxBorrow = process.env.MAX_BORROW ? Number(process.env.MAX_BORROW) : 5;
  const memberLoans = await loans.getByMember(memberId);
  const activeCount = memberLoans.filter(l => l.status === "borrowed" || l.status === "overdue").length;
  if (activeCount >= maxBorrow) return res.status(409).json({ error: `Member has reached borrow limit of ${maxBorrow}.` });

  const decremented = await books.decrementAvailable(bookId);
  if (!decremented) return res.status(409).json({ error: "No copies available to issue." });
  const loan = await loans.issue({ bookId, memberId });

  // audit log
  await audit.log("issue", req.session.librarian ? req.session.librarian.id : null, "librarian", "loan", loan.id, { bookId: loan.bookId, memberId: loan.memberId });

  res.status(201).json({ loan: await enrich(loan) });
}));

// Return — a member can return their own loan, a librarian can return any loan
router.post("/return", asyncHandler(async (req, res) => {
  const { loanId } = req.body;
  const loan = await loans.getById(loanId);
  if (!loan) return res.status(404).json({ error: "Loan not found." });

  const isOwner = req.session.member && req.session.member.id === loan.memberId;
  const isLibrarian = !!req.session.librarian;
  if (!isOwner && !isLibrarian) {
    return res.status(401).json({ error: "Log in as the member or a librarian to return this book." });
  }
  if (loan.status === "returned") {
    return res.status(409).json({ error: "This book was already returned." });
  }

  const updated = await loans.markReturned(loanId);
  await books.incrementAvailable(loan.bookId);
  // Try to assign hold to first reservation for this book
  const held = await loans.assignHoldForFirstReservation(loan.bookId);
  if (held) {
    // decrement available to hold for reserver
    await books.decrementAvailable(loan.bookId);
    // audit log for hold assignment
    await audit.log("hold-assigned", req.session.librarian ? req.session.librarian.id : null, "librarian", "loan", held.id, { bookId: loan.bookId, memberId: held.memberId, holdUntil: held.holdUntil });
  }
  // audit return
  await audit.log("return", req.session.member ? req.session.member.id : (req.session.librarian ? req.session.librarian.id : null), req.session.librarian ? "librarian" : "member", "loan", loanId, { bookId: loan.bookId });
  res.json({ loan: await enrich(updated) });
}));

// Member: pay their own fine
router.post("/pay-fine", requireMember, asyncHandler(async (req, res) => {
  const { loanId } = req.body;
  const loan = await loans.getById(loanId);
  if (!loan) return res.status(404).json({ error: "Loan not found." });
  if (loan.memberId !== req.session.member.id) {
    return res.status(403).json({ error: "You can only pay your own fines." });
  }
  const amountPaid = loan.fine || 0;
  const updated = await loans.payFine(loanId);
  // audit payment
  await audit.log("pay-fine", req.session.member ? req.session.member.id : null, "member", "loan", loanId, { amount: amountPaid });
  res.json({ loan: await enrich(updated), message: "Fine paid." });
}));

// Member: cancel their own reservation
router.delete("/reserve/:id", requireMember, asyncHandler(async (req, res) => {
  const loan = await loans.getById(req.params.id);
  if (!loan) return res.status(404).json({ error: "Reservation not found." });
  if (loan.memberId !== req.session.member.id) {
    return res.status(403).json({ error: "You can only cancel your own reservation." });
  }
  await loans.cancelReservation(req.params.id);
  // audit
  await audit.log("cancel-reservation", req.session.member.id, "member", "loan", req.params.id, { bookId: loan.bookId });
  res.json({ message: "Reservation cancelled." });
}));

// Member: view own loans/reservations/history
router.get("/mine", requireMember, asyncHandler(async (req, res) => {
  const memberLoans = await loans.getByMember(req.session.member.id);
  const result = await Promise.all(memberLoans.map(enrich));
  res.json({ loans: result });
}));

// Librarian: view everything
router.get("/", requireLibrarian, asyncHandler(async (req, res) => {
  const allLoans = await loans.getAll();
  const result = await Promise.all(allLoans.map(enrich));
  res.json({ loans: result });
}));

// Member: renew a loan
router.post("/:id/renew", requireMember, asyncHandler(async (req, res) => {
  const loanId = req.params.id;
  const loan = await loans.getById(loanId);
  if (!loan) return res.status(404).json({ error: "Loan not found." });
  if (loan.memberId !== req.session.member.id) return res.status(403).json({ error: "You can only renew your own loans." });
  if (loan.status !== "borrowed") return res.status(409).json({ error: "Only active borrowed loans can be renewed." });
  const maxRenewals = process.env.MAX_RENEWALS ? Number(process.env.MAX_RENEWALS) : 2;
  const renewed = await loans.renewLoan(loanId, maxRenewals);
  if (!renewed) return res.status(409).json({ error: `Cannot renew loan; maximum renewals (${maxRenewals}) reached or invalid state.` });
  // audit
  await audit.log("renew", req.session.member.id, "member", "loan", loanId, { newDueDate: renewed.dueDate });
  res.json({ loan: await enrich(renewed), message: "Loan renewed." });
}));

// Librarian: export loans to CSV
router.get("/export", requireLibrarian, asyncHandler(async (req, res) => {
  const allLoans = await loans.getAll();
  const enriched = await Promise.all(allLoans.map(enrich));
  // build CSV
  const headers = ["id", "bookId", "bookTitle", "memberId", "memberName", "status", "borrowDate", "dueDate", "returnDate", "fine", "renewalCount"];
  const rows = enriched.map(l => headers.map(h => {
    const v = l[h] !== undefined ? l[h] : "";
    // escape double quotes
    if (typeof v === 'string' && v.includes(',')) return `"${v.replace(/"/g, '""')}"`;
    return v;
  }).join(','));
  const csv = headers.join(',') + "\n" + rows.join("\n");
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="loans.csv"');
  res.send(csv);
}));

// Librarian: list recent payments
router.get("/payments", requireLibrarian, asyncHandler(async (req, res) => {
  const db = await (require("../data/db").getDb)();
  const payments = await db.collection("payments").find({}).sort({ paidAt: -1 }).limit(200).toArray();
  res.json({ payments });
}));

// Librarian: list recent audit logs
router.get("/audit-logs", requireLibrarian, asyncHandler(async (req, res) => {
  const db = await (require("../data/db").getDb)();
  const logs = await db.collection("auditLogs").find({}).sort({ createdAt: -1 }).limit(300).toArray();
  res.json({ logs });
}));

// Trigger overdue/fine recalculation (maintenance)
// Accessible to a librarian session OR by providing a valid MAINTENANCE_TOKEN as ?token=...
router.post("/recalculate", asyncHandler(async (req, res) => {
  const token = req.query.token;
  const tokenOk = token && process.env.MAINTENANCE_TOKEN && token === process.env.MAINTENANCE_TOKEN;
  const isLibrarian = !!req.session && !!req.session.librarian;
  if (!isLibrarian && !tokenOk) return res.status(401).json({ error: "Unauthorized. Provide a librarian session or valid maintenance token." });
  await loans.recalcOverdue();
  res.json({ message: "Recalculation triggered." });
}));

module.exports = router;