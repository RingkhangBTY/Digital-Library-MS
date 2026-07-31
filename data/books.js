const { getDb, getNextId } = require("./db");

function sanitizeBook(doc) {
  if (!doc) return null;
  const { _id, ...book } = doc;
  return book;
}

async function getAll() {
  const db = await getDb();
  const docs = await db.collection("books").find({}).sort({ id: 1 }).toArray();
  return docs.map(sanitizeBook);
}

async function getById(id) {
  const db = await getDb();
  const doc = await db.collection("books").findOne({ id: Number(id) });
  return sanitizeBook(doc);
}

async function create({ title, author, genre, branch, format, totalCopies }) {
  const db = await getDb();
  const id = await getNextId("books");
  const copies = Number(totalCopies) > 0 ? Number(totalCopies) : 1;

  const book = {
    id,
    title,
    author,
    genre: genre || "General",
    branch: branch || "Main Campus Library",
    format: format || "Physical",
    totalCopies: copies,
    availableCopies: copies,
    qr: `LIB-${String(id).padStart(4, "0")}`,
    timesBorrowed: 0
  };

  await db.collection("books").insertOne(book);
  return book;
}

async function update(id, updates) {
  const db = await getDb();
  const updateDoc = { ...updates };
  delete updateDoc.id;
  delete updateDoc._id;

  await db.collection("books").updateOne({ id: Number(id) }, { $set: updateDoc });
  return getById(id);
}

async function remove(id) {
  const db = await getDb();
  const result = await db.collection("books").deleteOne({ id: Number(id) });
  return result.deletedCount === 1;
}

async function decrementAvailable(id) {
  const db = await getDb();
  const result = await db.collection("books").updateOne(
    { id: Number(id), availableCopies: { $gt: 0 } },
    { $inc: { availableCopies: -1, timesBorrowed: 1 } }
  );
  return result.modifiedCount === 1;
}

async function incrementAvailable(id) {
  const db = await getDb();
  const result = await db.collection("books").updateOne(
    { id: Number(id), $expr: { $lt: ["$availableCopies", "$totalCopies"] } },
    { $inc: { availableCopies: 1 } }
  );
  if (result.modifiedCount === 1) return true;
  const exists = await getById(id);
  return !!exists;
}

module.exports = { getAll, getById, create, update, remove, decrementAvailable, incrementAvailable };