const express = require("express");
const router = express.Router();
const books = require("../data/books");
const { requireLibrarian } = require("../middleware/auth");

// Public — catalog browsing needs no login
router.get("/", (req, res) => {
  let result = books.getAll();
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
});

router.get("/:id", (req, res) => {
  const book = books.getById(req.params.id);
  if (!book) return res.status(404).json({ error: "Book not found." });
  res.json({ book });
});

// Librarian only — inventory CRUD
router.post("/", requireLibrarian, (req, res) => {
  const { title, author } = req.body;
  if (!title || !author) {
    return res.status(400).json({ error: "Title and author are required." });
  }
  const book = books.create(req.body);
  res.status(201).json({ book });
});

router.put("/:id", requireLibrarian, (req, res) => {
  const book = books.update(req.params.id, req.body);
  if (!book) return res.status(404).json({ error: "Book not found." });
  res.json({ book });
});

router.delete("/:id", requireLibrarian, (req, res) => {
  const ok = books.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Book not found." });
  res.json({ message: "Book deleted." });
});

module.exports = router;
