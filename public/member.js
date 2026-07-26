function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options
  });
  let data = {};
  try { data = await res.json(); } catch (e) { }
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function showAuthMsg(text, ok) {
  const el = document.getElementById("authMsg");
  el.textContent = text;
  el.className = "msg " + (ok ? "success" : "error");
  el.style.display = "block";
}

async function checkSession() {
  const data = await api("/api/auth/member/me");
  return data.member;
}

async function login() {
  const name = document.getElementById("loginName").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!name || !password) return showAuthMsg("Enter your name and password.", false);
  try {
    await api("/api/auth/member/login", { method: "POST", body: JSON.stringify({ name, password }) });
    await enterPortal();
  } catch (e) {
    showAuthMsg(e.message, false);
  }
}

async function register() {
  const name = document.getElementById("loginName").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!name || !password) return showAuthMsg("Enter a name and password to register.", false);
  try {
    await api("/api/auth/member/register", { method: "POST", body: JSON.stringify({ name, password }) });
    await enterPortal();
  } catch (e) {
    showAuthMsg(e.message, false);
  }
}

async function logout() {
  await api("/api/auth/member/logout", { method: "POST" });
  document.getElementById("portalSection").style.display = "none";
  document.getElementById("loginSection").style.display = "block";
}

function loanRow(loan, kind) {
  if (kind === "borrowed") {
    const fineText = loan.fine > 0 ? `₹${loan.fine}` : "₹0";
    const payBtn = loan.fine > 0 ? `<button data-loan-id="${loan.id}" class="pay-btn secondary">Pay Fine Online</button>` : "";
    return `
      <tr>
        <td data-label="Title">${escapeHtml(loan.bookTitle)}</td>
        <td data-label="Due Date">${escapeHtml(loan.dueDate)}</td>
        <td data-label="Fine">${fineText}</td>
        <td data-label="Action">
          <button data-loan-id="${loan.id}" class="return-btn">Return</button>
          ${payBtn}
        </td>
      </tr>`;
  }
  if (kind === "reserved") {
    return `
      <tr>
        <td data-label="Title">${escapeHtml(loan.bookTitle)}</td>
        <td data-label="Status"><span class="status-reserved">Ready for pickup</span></td>
        <td data-label="Action"><button data-loan-id="${loan.id}" class="cancel-btn danger">Cancel</button></td>
      </tr>`;
  }
  return `
    <tr>
      <td data-label="Title">${escapeHtml(loan.bookTitle)}</td>
      <td data-label="Borrowed On">${escapeHtml(loan.borrowDate || "—")}</td>
      <td data-label="Returned On">${escapeHtml(loan.returnDate || "—")}</td>
    </tr>`;
}

async function loadPortalData() {
  const data = await api("/api/loans/mine");
  const loans = data.loans;

  const borrowed = loans.filter(l => l.status === "borrowed" || l.status === "overdue");
  const reserved = loans.filter(l => l.status === "reserved");
  const history = loans.filter(l => l.status === "returned");

  document.getElementById("borrowedBody").innerHTML = borrowed.length
    ? borrowed.map(l => loanRow(l, "borrowed")).join("")
    : `<tr><td colspan="4">No books currently borrowed.</td></tr>`;

  document.getElementById("reservedBody").innerHTML = reserved.length
    ? reserved.map(l => loanRow(l, "reserved")).join("")
    : `<tr><td colspan="3">No active reservations.</td></tr>`;

  document.getElementById("historyBody").innerHTML = history.length
    ? history.map(l => loanRow(l, "history")).join("")
    : `<tr><td colspan="3">No borrowing history yet.</td></tr>`;

  const notifyList = document.getElementById("notifyList");
  const notifications = [];
  const overdue = loans.filter(l => l.status === "overdue");
  overdue.forEach(l => {
    notifications.push(`<li><strong>"${escapeHtml(l.bookTitle)}"</strong> is overdue. Fine of ₹${l.fine} is accruing.</li>`);
  });
  reserved.forEach(l => {
    notifications.push(`<li>Reminder: <strong>"${escapeHtml(l.bookTitle)}"</strong> reservation is ready for pickup.</li>`);
  });
  notifyList.innerHTML = notifications.length ? notifications.join("") : `<li>No new notifications.</li>`;

  document.querySelectorAll(".return-btn").forEach(btn => {
    btn.addEventListener("click", () => returnLoan(btn.dataset.loanId));
  });
  document.querySelectorAll(".pay-btn").forEach(btn => {
    btn.addEventListener("click", () => payFine(btn.dataset.loanId));
  });
  document.querySelectorAll(".cancel-btn").forEach(btn => {
    btn.addEventListener("click", () => cancelReservation(btn.dataset.loanId));
  });
}

async function returnLoan(loanId) {
  try {
    await api("/api/loans/return", { method: "POST", body: JSON.stringify({ loanId }) });
    await loadPortalData();
  } catch (e) {
    alert(e.message);
  }
}

async function payFine(loanId) {
  try {
    await api("/api/loans/pay-fine", { method: "POST", body: JSON.stringify({ loanId }) });
    await loadPortalData();
  } catch (e) {
    alert(e.message);
  }
}

async function cancelReservation(loanId) {
  try {
    await api("/api/loans/reserve/" + loanId, { method: "DELETE" });
    await loadPortalData();
  } catch (e) {
    alert(e.message);
  }
}

async function enterPortal() {
  const member = await checkSession();
  if (!member) return;
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("portalSection").style.display = "block";
  document.getElementById("memberNameLabel").textContent = member.name;
  await loadPortalData();
}

document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("registerBtn").addEventListener("click", register);
document.getElementById("logoutBtn").addEventListener("click", logout);

(async function init() {
  const member = await checkSession();
  if (member) await enterPortal();
})();
