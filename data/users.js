const crypto = require("crypto");
const { getDb, getNextId } = require("./db");

// salted hash
function hash(password, salt) {
  return crypto.createHash("sha256").update(salt + password).digest("hex");
}

function makeAccount({ id, name, email, password, extra = {} }) {
  const salt = crypto.randomBytes(8).toString("hex");
  return {
    id,
    name,
    nameLower: name.toLowerCase(),
    email,
    salt,
    passwordHash: hash(password, salt),
    ...extra
  };
}

function sanitizeAccount(account) {
  if (!account) return null;
  const { _id, ...rest } = account;
  return rest;
}

async function getAllMembers() {
  const db = await getDb();
  const members = await db.collection("members").find({}).sort({ id: 1 }).toArray();
  return members.map(sanitizeAccount);
}

async function getMemberById(id) {
  const db = await getDb();
  const member = await db.collection("members").findOne({ id: Number(id) });
  return sanitizeAccount(member);
}

async function getMemberByName(name) {
  const db = await getDb();
  const member = await db.collection("members").findOne({ nameLower: String(name).toLowerCase() });
  return sanitizeAccount(member);
}

function verifyMemberPassword(member, password) {
  return hash(password, member.salt) === member.passwordHash;
}

async function createMember({ name, email, password }) {
  if (await getMemberByName(name)) throw new Error("A member with that name already exists.");
  const id = await getNextId("members");
  const member = makeAccount({ id, name, email, password });
  const db = await getDb();
  try {
    await db.collection("members").insertOne(member);
  } catch (error) {
    if (error && error.code === 11000) {
      throw new Error("A member with that name already exists.");
    }
    throw error;
  }
  return member;
}

async function getLibrarianByName(name) {
  const db = await getDb();
  const librarian = await db
    .collection("librarians")
    .findOne({ nameLower: String(name).toLowerCase() });
  return sanitizeAccount(librarian);
}

function verifyLibrarianPassword(librarian, password) {
  return hash(password, librarian.salt) === librarian.passwordHash;
}

function toPublic(account) {
  if (!account) return null;
  const { passwordHash, salt, nameLower, ...pub } = account;
  return pub;
}

async function deleteMember(id) {
  const db = await getDb();
  const res = await db.collection("members").deleteOne({ id: Number(id) });
  return res.deletedCount === 1;
}

module.exports = {
  getAllMembers,
  getMemberById,
  getMemberByName,
  verifyMemberPassword,
  createMember,
  deleteMember,
  getLibrarianByName,
  verifyLibrarianPassword,
  toPublic
};