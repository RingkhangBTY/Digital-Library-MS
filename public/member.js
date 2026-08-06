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
  if (!el) return showPortalMsg(text, ok);
  el.textContent = text;
  el.className = "msg " + (ok ? "success" : "error");
  el.style.display = "block";
}

function showModalAuthMsg(text, ok) {
  const el = document.getElementById("modalAuthMsg");
  if (!el) return;
  if (!text) {
    el.style.display = "none";
    return;
  }
  el.textContent = text;
  el.className = "msg " + (ok ? "success" : "error");
  el.style.display = "block";
}

function showPortalMsg(text, ok) {
  const el = document.getElementById("portalActionMsg");
  el.textContent = text;
  el.className = "msg " + (ok ? "success" : "error");
  el.style.display = "block";
}

function setBusy(button, isBusy, label) {
  if (!button) return;
  button.disabled = isBusy;
  button.textContent = isBusy ? label : button.dataset.originalLabel || label;
}

function ensureNotificationControls() {
  const notifyList = document.getElementById("notifyList");
  if (!notifyList) return;
  if (document.getElementById("markNotificationsReadBtn")) return;
  const controls = document.createElement("div");
  controls.className = "controls";
  controls.style.marginBottom = "10px";
  controls.innerHTML = `
    <button id="markNotificationsReadBtn" class="secondary">Mark all as read</button>
    <button id="refreshNotificationsBtn" class="secondary">Refresh</button>
  `;
  notifyList.parentNode.insertBefore(controls, notifyList);
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
  } catch (e) { showAuthMsg(e.message, false); }
}

function openRegisterModal() {
  const modal = document.getElementById("registerModal");
  if (!modal) return;
  showModalAuthMsg("", true);
  document.getElementById("regName").value = "";
  document.getElementById("regEmail").value = "";
  document.getElementById("regPassword").value = "";
  document.getElementById("regConfirmPassword").value = "";
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
  setTimeout(() => document.getElementById("regName")?.focus(), 50);
}

function closeRegisterModal() {
  const modal = document.getElementById("registerModal");
  if (!modal) return;
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  showModalAuthMsg("", true);
}

async function registerModalSubmit(e) {
  if (e) e.preventDefault();
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirmPassword = document.getElementById("regConfirmPassword").value;

  if (!name || !email || !password) {
    return showModalAuthMsg("Please fill in Name, Email, and Password.", false);
  }
  if (!email.includes("@") || !email.includes(".")) {
    return showModalAuthMsg("Please enter a valid email address.", false);
  }
  if (password.length < 4) {
    return showModalAuthMsg("Password must be at least 4 characters long.", false);
  }
  if (password !== confirmPassword) {
    return showModalAuthMsg("Passwords do not match.", false);
  }

  const submitBtn = document.getElementById("submitRegisterBtn");
  const origText = submitBtn ? submitBtn.textContent : "Create Account";
  if (submitBtn) setBusy(submitBtn, true, "Creating Account…");

  try {
    await api("/api/auth/member/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password })
    });
    closeRegisterModal();
    await enterPortal();
  } catch (err) {
    showModalAuthMsg(err.message, false);
  } finally {
    if (submitBtn) setBusy(submitBtn, false, origText);
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
        <td data-label="Action" class="action-cell">
          <button data-loan-id="${loan.id}" class="return-btn">Return</button>
          ${payBtn}
        </td>
      </tr>`;
  }
  if (kind === "reserved") {
    const isOnHold = loan.status === "on-hold";
    return `
      <tr>
        <td data-label="Title">${escapeHtml(loan.bookTitle)}</td>
        <td data-label="Status"><span class="status-reserved">${isOnHold ? "On hold for pickup" : "Reserved"}</span></td>
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

async function renderNotifications(loans) {
  const notifyList = document.getElementById("notifyList");
  const notificationData = await api("/api/notifications/mine");
  const persisted = notificationData.notifications || [];
  const persistedItems = persisted.map((n) => {
    const icon = n.type === "overdue" ? "⚠️" : n.type === "hold-assigned" ? "📦" : "🔔";
    return `<li>${icon} ${escapeHtml(n.message)}</li>`;
  });

  // keep current status reminders as fallback so members still see active alerts immediately
  const fallback = [];
  loans.filter(l => l.status === "overdue").forEach(l => {
    fallback.push(`<li>⚠️ <strong>"${escapeHtml(l.bookTitle)}"</strong> is overdue. Fine of ₹${l.fine} is accruing.</li>`);
  });
  loans.filter(l => l.status === "on-hold").forEach(l => {
    fallback.push(`<li>📦 <strong>"${escapeHtml(l.bookTitle)}"</strong> is on hold for pickup.</li>`);
  });

  const merged = persistedItems.length ? persistedItems : fallback;
  notifyList.innerHTML = merged.length ? merged.join("") : `<li>✅ No new notifications.</li>`;
}

async function loadPortalData() {
  const data = await api("/api/loans/mine");
  const loans = data.loans;

  const borrowed = loans.filter(l => l.status === "borrowed" || l.status === "overdue");
  const reserved = loans.filter(l => l.status === "reserved" || l.status === "on-hold");
  const history = loans.filter(l => l.status === "returned");

  // Populate summary cards
  const totalFine = borrowed.reduce((sum, l) => sum + (l.fine || 0), 0);
  document.getElementById('sumBorrowed').textContent = borrowed.length;
  document.getElementById('sumReserved').textContent = reserved.length;
  document.getElementById('sumFine').textContent = '₹' + totalFine;
  document.getElementById('sumHistory').textContent = history.length;

  const emptyBorrowed = `<tr><td colspan="4"><div class="empty-state"><span class="empty-state-icon">📭</span>No books currently borrowed.</div></td></tr>`;
  const emptyReserved = `<tr><td colspan="3"><div class="empty-state"><span class="empty-state-icon">🔖</span>No active reservations.</div></td></tr>`;
  const emptyHistory = `<tr><td colspan="3"><div class="empty-state"><span class="empty-state-icon">📚</span>No borrowing history yet.</div></td></tr>`;

  document.getElementById("borrowedBody").innerHTML = borrowed.length ? borrowed.map(l => loanRow(l, "borrowed")).join("") : emptyBorrowed;
  document.getElementById("reservedBody").innerHTML = reserved.length ? reserved.map(l => loanRow(l, "reserved")).join("") : emptyReserved;
  document.getElementById("historyBody").innerHTML = history.length ? history.map(l => loanRow(l, "history")).join("") : emptyHistory;

  await renderNotifications(loans);

  document.querySelectorAll(".return-btn").forEach(btn => {
    btn.dataset.originalLabel = btn.textContent;
    btn.addEventListener("click", () => returnLoan(btn.dataset.loanId, btn));
  });
  document.querySelectorAll(".pay-btn").forEach(btn => {
    btn.dataset.originalLabel = btn.textContent;
    btn.addEventListener("click", () => payFine(btn.dataset.loanId, btn));
  });
  document.querySelectorAll(".cancel-btn").forEach(btn => {
    btn.dataset.originalLabel = btn.textContent;
    btn.addEventListener("click", () => cancelReservation(btn.dataset.loanId, btn));
  });
}

async function returnLoan(loanId, btn) {
  setBusy(btn, true, "Returning…");
  try {
    await api("/api/loans/return", { method: "POST", body: JSON.stringify({ loanId }) });
    showPortalMsg("✅ Book returned successfully.", true);
    await loadPortalData();
  } catch (e) { showPortalMsg(e.message, false); }
  finally { setBusy(btn, false, "Return"); }
}

async function payFine(loanId, btn) {
  setBusy(btn, true, "Paying…");
  try {
    await api("/api/loans/pay-fine", { method: "POST", body: JSON.stringify({ loanId }) });
    showPortalMsg("✅ Fine paid successfully.", true);
    await loadPortalData();
  } catch (e) { showPortalMsg(e.message, false); }
  finally { setBusy(btn, false, "Pay Fine Online"); }
}

async function cancelReservation(loanId, btn) {
  setBusy(btn, true, "Cancelling…");
  try {
    await api("/api/loans/reserve/" + loanId, { method: "DELETE" });
    showPortalMsg("✅ Reservation cancelled.", true);
    await loadPortalData();
  } catch (e) { showPortalMsg(e.message, false); }
  finally { setBusy(btn, false, "Cancel"); }
}

async function markAllNotificationsRead(btn) {
  setBusy(btn, true, "Marking…");
  try {
    await api("/api/notifications/mine/read-all", { method: "POST" });
    showPortalMsg("✅ Notifications marked as read.", true);
    await loadPortalData();
  } catch (e) {
    showPortalMsg(e.message, false);
  } finally {
    setBusy(btn, false, "Mark all as read");
  }
}

async function enterPortal() {
  const member = await checkSession();
  if (!member) return;
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("portalSection").style.display = "block";
  document.getElementById("memberNameLabel").textContent = member.name;
  ensureNotificationControls();
  await loadPortalData();
}

document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("registerBtn").addEventListener("click", openRegisterModal);
document.getElementById("closeRegisterModalBtn").addEventListener("click", closeRegisterModal);
document.getElementById("cancelRegisterBtn").addEventListener("click", closeRegisterModal);
document.getElementById("registerForm").addEventListener("submit", registerModalSubmit);
document.getElementById("logoutBtn").addEventListener("click", logout);

document.getElementById("registerModal").addEventListener("click", (e) => {
  if (e.target.id === "registerModal") closeRegisterModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeRegisterModal();
});
document.addEventListener("click", (event) => {
  const markReadBtn = event.target.closest("#markNotificationsReadBtn");
  if (markReadBtn) {
    markReadBtn.dataset.originalLabel = markReadBtn.dataset.originalLabel || markReadBtn.textContent;
    markAllNotificationsRead(markReadBtn);
    return;
  }
  const refreshNotifBtn = event.target.closest("#refreshNotificationsBtn");
  if (refreshNotifBtn) {
    loadPortalData();
  }
});

(async function init() {
  const member = await checkSession();
  if (member) await enterPortal();
})();