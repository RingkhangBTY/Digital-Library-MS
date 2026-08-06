const { getDb } = require("./db");

async function addNotification(memberId, type, message, meta = {}) {
  const db = await getDb();
  const doc = {
    memberId: Number(memberId),
    type,
    message,
    meta,
    createdAt: new Date().toISOString(),
    read: false
  };
  await db.collection("notifications").insertOne(doc);
  return doc;
}

async function getForMember(memberId, limit = 50) {
  const db = await getDb();
  const docs = await db.collection("notifications").find({ memberId: Number(memberId) }).sort({ createdAt: -1 }).limit(limit).toArray();
  return docs;
}

async function markAllReadForMember(memberId) {
  const db = await getDb();
  const result = await db.collection("notifications").updateMany(
    { memberId: Number(memberId), read: false },
    { $set: { read: true } }
  );
  return result.modifiedCount;
}

module.exports = { addNotification, getForMember, markAllReadForMember };