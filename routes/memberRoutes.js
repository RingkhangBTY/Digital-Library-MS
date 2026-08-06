const express = require("express");
const router = express.Router();
const users = require("../data/users");
const loans = require("../data/loans");
const { requireLibrarian } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/asyncHandler");

const books = require("../data/books");

// Helper to enrich loan objects with book details
async function enrichLoan(loan) {
  const book = await books.getById(loan.bookId);
  return {
    ...loan,
    bookTitle: book ? book.title : "Unknown book",
    bookAuthor: book ? book.author : "",
    availableCopies: book ? book.availableCopies : 0
  };
}

// Librarian only: list all members with live stats
router.get("/", requireLibrarian, asyncHandler(async (req, res) => {
  const [all, allLoans] = await Promise.all([users.getAllMembers(), loans.getAll()]);

  const result = all.map(m => {
    const memberLoans = allLoans.filter(l => l.memberId === m.id);
    const borrowedCount = memberLoans.filter(l => l.status === "borrowed" || l.status === "overdue").length;
    const reservedCount = memberLoans.filter(l => l.status === "reserved" || l.status === "on-hold").length;
    const totalLoansCount = memberLoans.length;
    const totalFinesPending = memberLoans.reduce((sum, l) => sum + (l.fine || 0), 0);

    return {
      id: m.id,
      name: m.name,
      email: m.email,
      borrowedCount,
      reservedCount,
      totalLoansCount,
      totalFinesPending
    };
  });

  res.json({ members: result });
}));

// Librarian only: view complete history and details for a specific member
router.get("/:id/history", requireLibrarian, asyncHandler(async (req, res) => {
  const memberId = Number(req.params.id);
  const member = await users.getMemberById(memberId);
  if (!member) return res.status(404).json({ error: "Member not found." });

  const memberLoans = await loans.getByMember(memberId);
  const enrichedLoans = await Promise.all(memberLoans.map(enrichLoan));

  res.json({
    member: users.toPublic(member),
    loans: enrichedLoans
  });
}));
// Librarian only: delete a member
router.delete("/:id", requireLibrarian, asyncHandler(async (req, res) => {
  const memberId = Number(req.params.id);
  const member = await users.getMemberById(memberId);
  if (!member) return res.status(404).json({ error: "Member not found." });

  // Check if member has active un-returned loans
  const memberLoans = await loans.getByMember(memberId);
  const activeBorrowed = memberLoans.filter(l => l.status === "borrowed" || l.status === "overdue");
  if (activeBorrowed.length > 0) {
    return res.status(409).json({ error: `Cannot remove member while they have ${activeBorrowed.length} active borrowed book(s). Please return all books first.` });
  }

  // Cancel any active reservations for this member
  const reservations = memberLoans.filter(l => l.status === "reserved" || l.status === "on-hold");
  for (const r of reservations) {
    await loans.cancelReservation(r.id);
  }

  await users.deleteMember(memberId);
  const audit = require("../data/audit");
  await audit.log("delete-member", req.session.librarian ? req.session.librarian.id : null, "librarian", "member", memberId, { name: member.name });

  res.json({ message: `Member "${member.name}" removed successfully.` });
}));

module.exports = router;
