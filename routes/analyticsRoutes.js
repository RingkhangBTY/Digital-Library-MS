const express = require("express");
const router = express.Router();
const books = require("../data/books");
const loans = require("../data/loans");
const { requireLibrarian } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/asyncHandler");

router.get("/dashboard", requireLibrarian, asyncHandler(async (req, res) => {
  const users = require("../data/users");
  const [allBooks, allLoans, allMembers] = await Promise.all([
    books.getAll(),
    loans.getAll(),
    users.getAllMembers()
  ]);

  const validMemberIds = new Set(allMembers.map(m => m.id));

  const totalBooks = allBooks.reduce((sum, b) => sum + b.totalCopies, 0);
  const issuedCount = allLoans.filter(l => l.status === "borrowed" || l.status === "overdue").length;
  const activeMembers = new Set(
    allLoans.filter(l => l.status !== "returned" && validMemberIds.has(l.memberId)).map(l => l.memberId)
  ).size;
  const pendingFines = allLoans
    .filter(l => validMemberIds.has(l.memberId))
    .reduce((sum, l) => sum + (l.fine || 0), 0);

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
}));

module.exports = router;