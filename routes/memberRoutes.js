const express = require("express");
const router = express.Router();
const users = require("../data/users");
const loans = require("../data/loans");
const { requireLibrarian } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/asyncHandler");

// Librarian only: list all members with a live count of currently borrowed books
router.get("/", requireLibrarian, asyncHandler(async (req, res) => {
  const [all, allLoans] = await Promise.all([users.getAllMembers(), loans.getAll()]);

  const result = all.map(m => {
    const borrowedCount = allLoans.filter(
      l => l.memberId === m.id && (l.status === "borrowed" || l.status === "overdue")
    ).length;
    return { id: m.id, name: m.name, email: m.email, borrowedCount };
  });

  res.json({ members: result });
}));

module.exports = router;
