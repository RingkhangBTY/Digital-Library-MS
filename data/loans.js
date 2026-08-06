const { getDb, getNextId } = require("./db");
const notifications = require("./notifications");
const audit = require("./audit");
// status: "borrowed" | "returned" | "overdue" | "reserved"

const DAY_MS = 24 * 60 * 60 * 1000;
const LOAN_DAYS = 14;
const FINE_PER_DAY = 5; // ₹5/day

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysFromNow(n) {
  return getLocalDateString(new Date(Date.now() + n * DAY_MS));
}

function sanitizeLoan(doc) {
  if (!doc) return null;
  const { _id, ...loan } = doc;
  return loan;
}

async function recalcOverdue() {
  const db = await getDb();
  const collection = db.collection("loans");
  const today = getLocalDateString();
  const rows = await collection
    .find({ dueDate: { $ne: null } })
    .toArray();

  if (rows.length === 0) return;

  const updates = [];
  for (const row of rows) {
    let status = row.status;
    let fine = row.fine || 0;

    if (row.finePaid) {
      fine = 0;
    } else if (status === "borrowed" || status === "overdue") {
      if (row.dueDate < today) {
        status = "overdue";
        const overdueDays = Math.max(0, Math.floor((Date.now() - new Date(row.dueDate)) / DAY_MS));
        const totalAccrued = overdueDays * FINE_PER_DAY;
        const paid = row.paidFineAmount || 0;
        fine = Math.max(0, totalAccrued - paid);
      } else {
        fine = 0;
      }
    } else if (status === "returned") {
      if (row.returnDate && row.dueDate && row.returnDate > row.dueDate) {
        const overdueDays = Math.max(0, Math.floor((new Date(row.returnDate) - new Date(row.dueDate)) / DAY_MS));
        const totalAccrued = overdueDays * FINE_PER_DAY;
        const paid = row.paidFineAmount || 0;
        fine = Math.max(0, totalAccrued - paid);
      } else {
        fine = 0;
      }
    }

    if (status !== row.status || fine !== row.fine) {
      updates.push({
        updateOne: {
          filter: { id: row.id },
          update: { $set: { status, fine } }
        }
      });
      if (row.status === "borrowed" && status === "overdue") {
        try {
          await notifications.addNotification(row.memberId, "overdue", `Your loan for book ID ${row.bookId} is overdue. Current fine: ₹${fine}.`, { loanId: row.id, fine });
        } catch (e) {
          console.error("Failed to add overdue notification:", e && e.message);
        }
      }
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
  // Ensure overdue status and fines are up-to-date before returning a single loan
  await recalcOverdue();
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
    borrowDate: getLocalDateString(),
    dueDate: daysFromNow(LOAN_DAYS),
    returnDate: null,
    status: "borrowed",
    fine: 0,
    renewalCount: 0
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
  const today = getLocalDateString();
  await (await getDb()).collection("loans").updateOne(
    { id: Number(loanId) },
    { $set: { returnDate: today, status: "returned" } }
  );
  return getById(loanId);
}

// When a copy is returned, assign the first waiting reservation (if any) to an on-hold state
async function assignHoldForFirstReservation(bookId, holdDays = 2) {
  const db = await getDb();
  // find the earliest reservation for this book
  const reservation = await db.collection("loans").findOne({ bookId: Number(bookId), status: "reserved" }, { sort: { id: 1 } });
  if (!reservation) return null;
  const holdUntil = daysFromNow(holdDays);
  await db.collection("loans").updateOne(
    { id: reservation.id },
    { $set: { status: "on-hold", holdUntil } }
  );
  // create a notification for the reserving member
  try {
    await notifications.addNotification(reservation.memberId, "hold-assigned", `A copy of the book (ID ${bookId}) is on hold for you until ${holdUntil}.`, { loanId: reservation.id, holdUntil });
  } catch (e) {
    console.error("Failed to add hold notification:", e && e.message);
  }
  // audit can be performed by caller
  // decrement available copies to hold the book for the reserver; books.decrementAvailable will be called from routes to keep concerns separate
  return getById(reservation.id);
}

async function payFine(loanId) {
  const loan = await getById(loanId);
  if (!loan) return null;
  const db = await getDb();
  const amount = loan.fine || 0;
  const currentPaid = loan.paidFineAmount || 0;
  const newPaidTotal = currentPaid + (amount > 0 ? amount : (loan.fine || 0));
  // record payment in payments collection for audit/history
  if (amount > 0) {
    await db.collection("payments").insertOne({
      loanId: loan.id,
      memberId: loan.memberId,
      amount,
      paidAt: new Date().toISOString()
    });
  }
  await db.collection("loans").updateOne(
    { id: Number(loanId) },
    { $set: { fine: 0, paidFineAmount: newPaidTotal, finePaid: true } }
  );
  return getById(loanId);
}

async function cancelReservation(loanId) {
  const db = await getDb();
  const result = await db.collection("loans").deleteOne({ id: Number(loanId) });
  return result.deletedCount === 1;
}

async function renewLoan(loanId, maxRenewals = 2) {
  const loan = await getById(loanId);
  if (!loan) return null;
  const db = await getDb();
  const currentRenewals = loan.renewalCount || 0;
  if (currentRenewals >= maxRenewals) return null;
  // extend dueDate by LOAN_DAYS from current dueDate
  const currentDue = new Date(loan.dueDate);
  const newDue = new Date(currentDue.getTime() + LOAN_DAYS * DAY_MS);
  const newDueStr = getLocalDateString(newDue);
  await db.collection("loans").updateOne({ id: Number(loanId) }, { $set: { dueDate: newDueStr }, $inc: { renewalCount: 1 } });
  return getById(loanId);
}

async function issueReservation(loanId) {
  const loan = await getById(loanId);
  if (!loan) throw new Error("Reservation not found.");
  if (loan.status !== "reserved" && loan.status !== "on-hold") {
    throw new Error("This loan is not an active reservation.");
  }
  const db = await getDb();
  const book = await db.collection("books").findOne({ id: Number(loan.bookId) });
  if (!book) throw new Error("Book not found.");

  // If status was 'reserved' (not on-hold), check if available copies exist and decrement
  if (loan.status === "reserved") {
    if (book.availableCopies <= 0) {
      throw new Error("No available copies for this book right now.");
    }
    await db.collection("books").updateOne({ id: Number(loan.bookId) }, { $inc: { availableCopies: -1 } });
  }

  const today = getLocalDateString();
  const due = daysFromNow(LOAN_DAYS);

  await db.collection("loans").updateOne(
    { id: Number(loanId) },
    {
      $set: {
        status: "borrowed",
        borrowDate: today,
        dueDate: due
      },
      $unset: { holdUntil: "" }
    }
  );

  try {
    await notifications.addNotification(
      loan.memberId,
      "loan-issued",
      `Your reserved book "${book.title}" has been issued to you by the librarian! Due date: ${due}.`,
      { loanId: loan.id, dueDate: due }
    );
  } catch (e) {
    console.error("Failed to add notification for reservation issue:", e && e.message);
  }

  return getById(loanId);
}

module.exports = {
  getAll,
  getById,
  getByMember,
  issue,
  reserve,
  issueReservation,
  markReturned,
  payFine,
  cancelReservation,
  renewLoan,
  recalcOverdue,
  assignHoldForFirstReservation,
  LOAN_DAYS,
  FINE_PER_DAY
};