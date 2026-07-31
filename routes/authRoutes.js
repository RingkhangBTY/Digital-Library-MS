const express = require("express");
const router = express.Router();
const users = require("../data/users");
const { asyncHandler } = require("../middleware/asyncHandler");

// ---- Member auth ----

router.post("/member/register", asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !password) {
    return res.status(400).json({ error: "Name and password are required." });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters." });
  }
  try {
    const member = await users.createMember({ name, email, password });
    req.session.member = { id: member.id, name: member.name };
    res.status(201).json({ member: users.toPublic(member) });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
}));

router.post("/member/login", asyncHandler(async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    return res.status(400).json({ error: "Name and password are required." });
  }
  const member = await users.getMemberByName(name);
  if (!member || !users.verifyMemberPassword(member, password)) {
    return res.status(401).json({ error: "Invalid name or password." });
  }
  req.session.member = { id: member.id, name: member.name };
  res.json({ member: users.toPublic(member) });
}));

router.post("/member/logout", (req, res) => {
  delete req.session.member;
  res.json({ message: "Logged out." });
});

router.get("/member/me", (req, res) => {
  res.json({ member: req.session.member || null });
});

// ---- Librarian auth ----

router.post("/librarian/login", asyncHandler(async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    return res.status(400).json({ error: "Name and password are required." });
  }
  const librarian = await users.getLibrarianByName(name);
  if (!librarian || !users.verifyLibrarianPassword(librarian, password)) {
    return res.status(401).json({ error: "Invalid name or password." });
  }
  req.session.librarian = { id: librarian.id, name: librarian.name };
  res.json({ librarian: users.toPublic(librarian) });
}));

router.post("/librarian/logout", (req, res) => {
  delete req.session.librarian;
  res.json({ message: "Logged out." });
});

router.get("/librarian/me", (req, res) => {
  res.json({ librarian: req.session.librarian || null });
});

module.exports = router;
