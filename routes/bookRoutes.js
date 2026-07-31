const express = require("express");
const router = express.Router();
const books = require("../data/books");
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
  res.status(201).json({ book });
}));

router.put("/:id", requireLibrarian, asyncHandler(async (req, res) => {
  const book = await books.update(req.params.id, req.body);
  if (!book) return res.status(404).json({ error: "Book not found." });
  res.json({ book });
}));

router.delete("/:id", requireLibrarian, asyncHandler(async (req, res) => {
  const ok = await books.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Book not found." });
  res.json({ message: "Book deleted." });
}));

module.exports = router;
