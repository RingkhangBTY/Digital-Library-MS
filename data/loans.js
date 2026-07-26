// In-memory loan + reservation records.
// status: "borrowed" | "returned" | "overdue" | "reserved"

const DAY_MS = 24 * 60 * 60 * 1000;
const LOAN_DAYS = 14;
const FINE_PER_DAY = 5; // ₹5/day, matches ₹20 fine on a 4-day-overdue book in the mockup

function daysAgo(n) { return new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10); }
function daysFromNow(n) { return new Date(Date.now() + n * DAY_MS).toISOString().slice(0, 10); }

let loans = [
  // Riya (member id 2) has "1984" (book id 4) overdue by 4 days, matching mockup's ₹20 fine
  { id: 1, bookId: 4, memberId: 2, borrowDate: daysAgo(18), dueDate: daysAgo(4), returnDate: null, status: "overdue", fine: 20 },

  // Ringkhang (member id 1) has "Clean Code" (book id 2) reserved, ready for pickup
  { id: 2, bookId: 2, memberId: 1, borrowDate: null, dueDate: null, returnDate: null, status: "reserved", fine: 0 },

  // Ringkhang's borrowing history (already returned)
  { id: 3, bookId: 1, memberId: 1, borrowDate: "2026-05-01", dueDate: "2026-05-15", returnDate: "2026-05-15", status: "returned", fine: 0 },
  { id: 4, bookId: 3, memberId: 1, borrowDate: "2026-06-01", dueDate: "2026-06-15", returnDate: "2026-06-20", status: "returned", fine: 25 }
];
let nextId = loans.length + 1;

function recalcOverdue() {
  const today = new Date().toISOString().slice(0, 10);
  loans.forEach(l => {
    if (l.status === "borrowed" && l.dueDate && l.dueDate < today) l.status = "overdue";
    if (l.status === "overdue" && !l.returnDate) {
      const overdueDays = Math.max(0, Math.floor((Date.now() - new Date(l.dueDate)) / DAY_MS));
      l.fine = overdueDays * FINE_PER_DAY;
    }
  });
}

function getAll() {
  recalcOverdue();
  return loans;
}
function getById(id) {
  return loans.find(l => l.id === Number(id));
}
function getByMember(memberId) {
  recalcOverdue();
  return loans.filter(l => l.memberId === Number(memberId));
}

function issue({ bookId, memberId }) {
  const loan = {
    id: nextId++,
    bookId: Number(bookId),
    memberId: Number(memberId),
    borrowDate: new Date().toISOString().slice(0, 10),
    dueDate: daysFromNow(LOAN_DAYS),
    returnDate: null,
    status: "borrowed",
    fine: 0
  };
  loans.push(loan);
  return loan;
}

function reserve({ bookId, memberId }) {
  const loan = {
    id: nextId++,
    bookId: Number(bookId),
    memberId: Number(memberId),
    borrowDate: null,
    dueDate: null,
    returnDate: null,
    status: "reserved",
    fine: 0
  };
  loans.push(loan);
  return loan;
}

function markReturned(loanId) {
  const loan = getById(loanId);
  if (!loan) return null;
  loan.returnDate = new Date().toISOString().slice(0, 10);
  loan.status = "returned";
  return loan;
}

function payFine(loanId) {
  const loan = getById(loanId);
  if (!loan) return null;
  loan.fine = 0;
  return loan;
}

function cancelReservation(loanId) {
  const idx = loans.findIndex(l => l.id === Number(loanId));
  if (idx === -1) return false;
  loans.splice(idx, 1);
  return true;
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