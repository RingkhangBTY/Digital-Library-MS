const express = require("express");
const router = express.Router();
const loans = require("../data/loans");
const books = require("../data/books");
const users = require("../data/users");
const { requireMember, requireLibrarian } = require("../middleware/auth");

function enrich(loan) {
  const book = books.getById(loan.bookId);
  const member = users.getMemberById(loan.memberId);
  return {
    ...loan,
    bookTitle: book ? book.title : "Unknown book",
    bookAuthor: book ? book.author : "",
    memberName: member ? member.name : "Unknown member"
  };
}

// Member: reserve a book (only makes sense if it's unavailable, but we allow either way per brief)
router.post("/reserve", requireMember, (req, res) => {
  const { bookId } = req.body;
  const book = books.getById(bookId);
  if (!book) return res.status(404).json({ error: "Book not found." });
  const loan = loans.reserve({ bookId, memberId: req.session.member.id });
  res.status(201).json({ loan: enrich(loan) });
});

// Librarian: issue a book directly to a member
router.post("/issue", requireLibrarian, (req, res) => {
  const { bookId, memberId } = req.body;
  const book = books.getById(bookId);
  if (!book) return res.status(404).json({ error: "Book not found." });
  if (!users.getMemberById(memberId)) return res.status(404).json({ error: "Member not found." });
  if (book.availableCopies <= 0) return res.status(409).json({ error: "No copies available to issue." });

  books.decrementAvailable(bookId);
  const loan = loans.issue({ bookId, memberId });
  res.status(201).json({ loan: enrich(loan) });
});

// Return — a member can return their own loan, a librarian can return any loan
router.post("/return", (req, res) => {
  const { loanId } = req.body;
  const loan = loans.getById(loanId);
  if (!loan) return res.status(404).json({ error: "Loan not found." });

  const isOwner = req.session.member && req.session.member.id === loan.memberId;
  const isLibrarian = !!req.session.librarian;
  if (!isOwner && !isLibrarian) {
    return res.status(401).json({ error: "Log in as the member or a librarian to return this book." });
  }
  if (loan.status === "returned") {
    return res.status(409).json({ error: "This book was already returned." });
  }

  loans.markReturned(loanId);
  books.incrementAvailable(loan.bookId);
  res.json({ loan: enrich(loan) });
});

// Member: pay their own fine
router.post("/pay-fine", requireMember, (req, res) => {
  const { loanId } = req.body;
  const loan = loans.getById(loanId);
  if (!loan) return res.status(404).json({ error: "Loan not found." });
  if (loan.memberId !== req.session.member.id) {
    return res.status(403).json({ error: "You can only pay your own fines." });
  }
  loans.payFine(loanId);
  res.json({ loan: enrich(loan), message: "Fine paid." });
});

// Member: cancel their own reservation
router.delete("/reserve/:id", requireMember, (req, res) => {
  const loan = loans.getById(req.params.id);
  if (!loan) return res.status(404).json({ error: "Reservation not found." });
  if (loan.memberId !== req.session.member.id) {
    return res.status(403).json({ error: "You can only cancel your own reservation." });
  }
  loans.cancelReservation(req.params.id);
  res.json({ message: "Reservation cancelled." });
});

// Member: view own loans/reservations/history
router.get("/mine", requireMember, (req, res) => {
  const result = loans.getByMember(req.session.member.id).map(enrich);
  res.json({ loans: result });
});

// Librarian: view everything
router.get("/", requireLibrarian, (req, res) => {
  const result = loans.getAll().map(enrich);
  res.json({ loans: result });
});

module.exports = router;
