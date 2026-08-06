const express = require("express");
const router = express.Router();
const books = require("../data/books");
const audit = require("../data/audit");
const { requireLibrarian } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/asyncHandler");

// Public — catalog browsing needs no login
router.get("/", asyncHandler(async (req, res) => {
  let result = await books.getAll();
  const { q, genre, status } = req.query;

  if (q) {
    const term = q.toLowerCase();
    result = result.filter(
      b => b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term)
    );
  }
  if (genre && genre !== "All Genres") {
    result = result.filter(b => b.genre.toLowerCase() === genre.toLowerCase());
  }
  if (status === "Available") {
    result = result.filter(b => b.availableCopies > 0);
  } else if (status === "Issued") {
    result = result.filter(b => b.availableCopies === 0);
  }

  res.json({ books: result });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const book = await books.getById(req.params.id);
  if (!book) return res.status(404).json({ error: "Book not found." });
  res.json({ book });
}));

// Librarian only — inventory CRUD
router.post("/", requireLibrarian, asyncHandler(async (req, res) => {
  const { title, author } = req.body;
  if (!title || !author) {
    return res.status(400).json({ error: "Title and author are required." });
  }
  const book = await books.create(req.body);
  // audit
  await audit.log("create-book", req.session.librarian ? req.session.librarian.id : null, "librarian", "book", book.id, { title: book.title });
  res.status(201).json({ book });
}));

router.put("/:id", requireLibrarian, asyncHandler(async (req, res) => {
  const before = await books.getById(req.params.id);
  const book = await books.update(req.params.id, req.body);
  if (!book) return res.status(404).json({ error: "Book not found." });
  // audit
  await audit.log("update-book", req.session.librarian ? req.session.librarian.id : null, "librarian", "book", book.id, { before, after: book });
  res.json({ book });
}));

router.delete("/:id", requireLibrarian, asyncHandler(async (req, res) => {
  const before = await books.getById(req.params.id);
  const ok = await books.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Book not found." });
  // audit
  await audit.log("delete-book", req.session.librarian ? req.session.librarian.id : null, "librarian", "book", req.params.id, { before });
  res.json({ message: "Book deleted." });
}));

// Librarian: export books to CSV
router.get("/export", requireLibrarian, asyncHandler(async (req, res) => {
  const allBooks = await books.getAll();
  const headers = ["id","title","author","genre","branch","format","totalCopies","availableCopies","qr","timesBorrowed"];
  const rows = allBooks.map(b => headers.map(h => {
    const v = b[h] !== undefined ? b[h] : "";
    if (typeof v === 'string' && v.includes(',')) return `"${v.replace(/"/g, '""')}"`;
    return v;
  }).join(','));
  const csv = headers.join(',') + "\n" + rows.join("\n");
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="books.csv"');
  res.send(csv);
}));

module.exports = router;
