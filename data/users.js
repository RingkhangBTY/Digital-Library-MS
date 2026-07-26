const crypto = require("crypto");

// Dependency-free salted hash
function hash(password, salt) {
  return crypto.createHash("sha256").update(salt + password).digest("hex");
}

function makeAccount({ id, name, email, password, extra = {} }) {
  const salt = crypto.randomBytes(8).toString("hex");
  return {
    id,
    name,
    email,
    salt,
    passwordHash: hash(password, salt),
    ...extra
  };
}

// --- Members  ---
let members = [
  makeAccount({ id: 1, name: "Ringkhang", email: "ringkhang@example.com", password: "member123" }),
  makeAccount({ id: 2, name: "Riya", email: "riya@example.com", password: "member123" }),
  makeAccount({ id: 3, name: "Aman", email: "aman@example.com", password: "member123" })
];
let nextMemberId = members.length + 1;

// --- Librarians ---
let librarians = [
  makeAccount({ id: 1, name: "Head Librarian", email: "librarian@example.com", password: "admin123" })
];

function getAllMembers() {
  return members;
}
function getMemberById(id) {
  return members.find(m => m.id === Number(id));
}
function getMemberByName(name) {
  return members.find(m => m.name.toLowerCase() === String(name).toLowerCase());
}
function verifyMemberPassword(member, password) {
  return hash(password, member.salt) === member.passwordHash;
}
function createMember({ name, email, password }) {
  if (getMemberByName(name)) throw new Error("A member with that name already exists.");
  const member = makeAccount({ id: nextMemberId++, name, email, password });
  members.push(member);
  return member;
}

function getLibrarianByName(name) {
  return librarians.find(l => l.name.toLowerCase() === String(name).toLowerCase());
}
function verifyLibrarianPassword(librarian, password) {
  return hash(password, librarian.salt) === librarian.passwordHash;
}

function toPublic(account) {
  if (!account) return null;
  const { passwordHash, salt, ...pub } = account;
  return pub;
}

module.exports = {
  getAllMembers,
  getMemberById,
  getMemberByName,
  verifyMemberPassword,
  createMember,
  getLibrarianByName,
  verifyLibrarianPassword,
  toPublic
};