require("dotenv").config();

const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME;

if (!MONGODB_URI) {
  throw new Error("Missing required environment variable: MONGODB_URI");
}
if (!DB_NAME) {
  throw new Error("Missing required environment variable: MONGODB_DB_NAME");
}

let client;
let db;
let initializePromise;

async function getDb() {
  if (db) return db;
  client = client || new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);
  return db;
}

async function ensureIndexes(database) {
  await Promise.all([
    database.collection("books").createIndex({ id: 1 }, { unique: true }),
    database.collection("members").createIndex({ id: 1 }, { unique: true }),
    database.collection("members").createIndex({ nameLower: 1 }, { unique: true }),
    database.collection("librarians").createIndex({ id: 1 }, { unique: true }),
    database.collection("librarians").createIndex({ nameLower: 1 }, { unique: true }),
    database.collection("loans").createIndex({ id: 1 }, { unique: true }),
    database.collection("counters").createIndex({ name: 1 }, { unique: true }),
    // support additional telemetry collections
    database.collection("auditLogs").createIndex({ createdAt: -1 }),
    database.collection("payments").createIndex({ loanId: 1 }),
    database.collection("notifications").createIndex({ memberId: 1, createdAt: -1 })
  ]);
}

async function setCounterToAtLeast(database, name, value) {
  await database
    .collection("counters")
    .updateOne({ name }, { $max: { value } }, { upsert: true });
}

async function maxId(database, collectionName) {
  const doc = await database
    .collection(collectionName)
    .find({}, { projection: { id: 1 } })
    .sort({ id: -1 })
    .limit(1)
    .next();
  return doc ? doc.id : 0;
}

async function initializeDatabase() {
  if (initializePromise) return initializePromise;

  initializePromise = (async () => {
    const database = await getDb();
    await ensureIndexes(database);

    const [bookMaxId, memberMaxId, librarianMaxId, loanMaxId] = await Promise.all([
      maxId(database, "books"),
      maxId(database, "members"),
      maxId(database, "librarians"),
      maxId(database, "loans")
    ]);

    await Promise.all([
      setCounterToAtLeast(database, "books", bookMaxId),
      setCounterToAtLeast(database, "members", memberMaxId),
      setCounterToAtLeast(database, "librarians", librarianMaxId),
      setCounterToAtLeast(database, "loans", loanMaxId)
    ]);
  })();

  return initializePromise;
}

async function getNextId(counterName) {
  const database = await getDb();
  const result = await database.collection("counters").findOneAndUpdate(
    { name: counterName },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  const counter = result && typeof result.value === "number" ? result : result && result.value;
  if (!counter || typeof counter.value !== "number") {
    throw new Error(`Failed to generate ID for counter "${counterName}".`);
  }
  return counter.value;
}

module.exports = { getDb, initializeDatabase, getNextId };
