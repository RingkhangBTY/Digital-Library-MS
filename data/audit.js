const { getDb } = require("./db");

async function log(action, userId, userType, targetType, targetId, details = {}) {
  const db = await getDb();
  await db.collection("auditLogs").insertOne({
    action,
    userId: userId || null,
    userType: userType || null,
    targetType: targetType || null,
    targetId: targetId || null,
    details,
    createdAt: new Date().toISOString()
  });
}

module.exports = { log };