const { getDb, getNextId } = require("./db");
// status: "borrowed" | "returned" | "overdue" | "reserved"

const DAY_MS = 24 * 60 * 60 * 1000;
const LOAN_DAYS = 14;
const FINE_PER_DAY = 5; // ₹5/day, matches ₹20 fine on a 4-day-overdue book in the mockup

function daysFromNow(n) { return new Date(Date.now() + n * DAY_MS).toISOString().slice(0, 10); }

function sanitizeLoan(doc) {
  if (!doc) return null;
  const { _id, ...loan } = doc;
  return loan;
}

async function recalcOverdue() {
  const db = await getDb();
  const collection = db.collection("loans");
  const today = new Date().toISOString().slice(0, 10);
  const rows = await collection
    .find({ status: { $in: ["borrowed", "overdue"] }, returnDate: null, dueDate: { $ne: null } })
    .toArray();

  if (rows.length === 0) return;

  const updates = [];
  for (const row of rows) {
    let status = row.status;
    if (status === "borrowed" && row.dueDate < today) {
      status = "overdue";
    }
    let fine = row.fine || 0;
    if (status === "overdue") {
      const overdueDays = Math.max(0, Math.floor((Date.now() - new Date(row.dueDate)) / DAY_MS));
      fine = overdueDays * FINE_PER_DAY;
    }
    if (status !== row.status || fine !== row.fine) {
      updates.push({
        updateOne: {
          filter: { id: row.id },
          update: { $set: { status, fine } }
        }
      });
    }
  }
  if (updates.length > 0) {
    await collection.bulkWrite(updates);
  }
}

async function getAll() {
  await recalcOverdue();
  const db = await getDb();
  const docs = await db.collection("loans").find({}).sort({ id: 1 }).toArray();
  return docs.map(sanitizeLoan);
}

async function getById(id) {
  const db = await getDb();
  const doc = await db.collection("loans").findOne({ id: Number(id) });
  return sanitizeLoan(doc);
}

async function getByMember(memberId) {
  await recalcOverdue();
  const db = await getDb();
  const docs = await db
    .collection("loans")
    .find({ memberId: Number(memberId) })
    .sort({ id: 1 })
    .toArray();
  return docs.map(sanitizeLoan);
}

async function issue({ bookId, memberId }) {
  const db = await getDb();
  const id = await getNextId("loans");
  const loan = {
    id,
    bookId: Number(bookId),
    memberId: Number(memberId),
    borrowDate: new Date().toISOString().slice(0, 10),
    dueDate: daysFromNow(LOAN_DAYS),
    returnDate: null,
    status: "borrowed",
    fine: 0
  };
  await db.collection("loans").insertOne(loan);
  return loan;
}

async function reserve({ bookId, memberId }) {
  const db = await getDb();
  const id = await getNextId("loans");
  const loan = {
    id,
    bookId: Number(bookId),
    memberId: Number(memberId),
    borrowDate: null,
    dueDate: null,
    returnDate: null,
    status: "reserved",
    fine: 0
  };
  await db.collection("loans").insertOne(loan);
  return loan;
}

async function markReturned(loanId) {
  const loan = await getById(loanId);
  if (!loan) return null;
  await (await getDb()).collection("loans").updateOne(
    { id: Number(loanId) },
    { $set: { returnDate: new Date().toISOString().slice(0, 10), status: "returned" } }
  );
  return getById(loanId);
}

async function payFine(loanId) {
  const loan = await getById(loanId);
  if (!loan) return null;
  await (await getDb()).collection("loans").updateOne({ id: Number(loanId) }, { $set: { fine: 0 } });
  return getById(loanId);
}

async function cancelReservation(loanId) {
  const db = await getDb();
  const result = await db.collection("loans").deleteOne({ id: Number(loanId) });
  return result.deletedCount === 1;
}

module.exports = {
  getAll,
  getById,
  getByMember,
  issue,
  reserve,
  markReturned,
  payFine,
  cancelReservation,
  LOAN_DAYS,
  FINE_PER_DAY
};