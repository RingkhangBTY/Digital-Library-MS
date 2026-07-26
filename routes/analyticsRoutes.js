const express = require("express");
const router = express.Router();
const books = require("../data/books");
const loans = require("../data/loans");
const users = require("../data/users");
const { requireLibrarian } = require("../middleware/auth");

router.get("/dashboard", requireLibrarian, (req, res) => {
  const allBooks = books.getAll();
  const allLoans = loans.getAll();

  const totalBooks = allBooks.reduce((sum, b) => sum + b.totalCopies, 0);
  const issuedCount = allLoans.filter(l => l.status === "borrowed" || l.status === "overdue").length;
  const activeMembers = new Set(
    allLoans.filter(l => l.status !== "returned").map(l => l.memberId)
  ).size;
  const pendingFines = allLoans.reduce((sum, l) => sum + (l.fine || 0), 0);

  const mostBorrowed = [...allBooks]
    .sort((a, b) => b.timesBorrowed - a.timesBorrowed)
    .slice(0, 5)
    .map(b => ({ title: b.title, timesBorrowed: b.timesBorrowed }));

  res.json({
    totalBooks,
    issuedCount,
    activeMembers,
    pendingFines,
    mostBorrowed
  });
});

module.exports = router;
