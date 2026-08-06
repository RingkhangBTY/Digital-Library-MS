let _allBooks = [];

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}

function resetBookForm() {
  document.getElementById("addBookForm").reset();
  document.getElementById("editingBookId").value = "";
  document.getElementById("newCopies").value = "1";
  document.getElementById("newFormat").value = "Physical";
  document.getElementById("bookSubmitBtn").textContent = "Add Book";
  document.getElementById("bookFormTitle").textContent = "Add New Book";
  document.getElementById("cancelEditBtn").style.display = "none";
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

function showMsg(elId, text, ok) {
  const el = document.getElementById(elId);
  el.textContent = text;
  el.className = "msg " + (ok ? "success" : "error");
  el.style.display = "block";
}

async function checkSession() {
  const data = await api("/api/auth/librarian/me");
  return data.librarian;
}

async function login() {
  const name = document.getElementById("loginName").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!name || !password) return showMsg("authMsg", "Enter name and password.", false);
  try {
    await api("/api/auth/librarian/login", { method: "POST", body: JSON.stringify({ name, password }) });
    await enterPanel();
  } catch (e) {
    showMsg("authMsg", e.message, false);
  }
}

async function logout() {
  await api("/api/auth/librarian/logout", { method: "POST" });
  document.getElementById("panelSection").style.display = "none";
  document.getElementById("loginSection").style.display = "block";
}

async function loadDashboard() {
  const stats = await api("/api/analytics/dashboard");
  document.getElementById("statGrid").innerHTML = `
    <div class="statCard"><span class="statNum">${stats.totalBooks}</span>Total Books</div>
    <div class="statCard"><span class="statNum">${stats.issuedCount}</span>Books Issued</div>
    <div class="statCard"><span class="statNum">${stats.activeMembers}</span>Active Members</div>
    <div class="statCard"><span class="statNum">₹${stats.pendingFines}</span>Fines Pending</div>
  `;
  document.getElementById("mostBorrowedBody").innerHTML = stats.mostBorrowed.length
    ? stats.mostBorrowed.map(b => `<tr><td data-label="Title">${escapeHtml(b.title)}</td><td data-label="Times">${b.timesBorrowed}</td></tr>`).join("")
    : `<tr><td colspan="2">No borrowing data yet.</td></tr>`;
}

let _invVisibleCount = 10;
let _currentFilteredBooks = [];

function renderInventory(books) {
  _currentFilteredBooks = books || [];
  const tbody = document.getElementById("inventoryBody");
  const wrapper = document.getElementById("invShowMoreWrapper");
  const moreBtn = document.getElementById("invShowMoreBtn");
  const lessBtn = document.getElementById("invShowLessBtn");
  const countSpan = document.getElementById("invShowMoreCount");

  if (!books.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">No books match your search.</td></tr>`;
    if (wrapper) wrapper.style.display = "none";
    return;
  }

  const displayed = books.slice(0, _invVisibleCount);
  tbody.innerHTML = displayed.map(b => {
    const available = b.availableCopies > 0;
    return `
      <tr>
        <td data-label="Title">${escapeHtml(b.title)}</td>
        <td data-label="Author">${escapeHtml(b.author)}</td>
        <td data-label="Genre">${escapeHtml(b.genre)}</td>
        <td data-label="Copies">${b.availableCopies} / ${b.totalCopies}</td>
        <td data-label="Status"><span class="${available ? "status-available" : "status-issued"}">${available ? "Available" : "Fully Issued"}</span></td>
        <td data-label="Action" class="action-cell">
          <button data-book-id="${b.id}" class="edit-book-btn secondary">Edit</button>
          <button data-book-id="${b.id}" class="delete-book-btn danger">Delete</button>
        </td>
      </tr>`;
  }).join("");

  document.querySelectorAll(".edit-book-btn").forEach(btn => {
    btn.addEventListener("click", () => editBook(btn.dataset.bookId));
  });
  document.querySelectorAll(".delete-book-btn").forEach(btn => {
    btn.addEventListener("click", () => deleteBook(btn.dataset.bookId));
  });

  if (wrapper && countSpan) {
    wrapper.style.display = "flex";
    countSpan.textContent = `Showing ${displayed.length} of ${books.length} books`;

    if (moreBtn) {
      moreBtn.style.display = _invVisibleCount < books.length ? "inline-flex" : "none";
    }
    if (lessBtn) {
      lessBtn.style.display = _invVisibleCount > 10 ? "inline-flex" : "none";
    }
  }
}

function filterInventory(resetCount = true) {
  if (resetCount) _invVisibleCount = 10;
  const q = (document.getElementById("inventorySearch").value || "").toLowerCase().trim();
  const status = (document.getElementById("inventoryStatusFilter").value || "").toLowerCase();
  const filtered = _allBooks.filter(b => {
    const matchQ = !q ||
      (b.title || "").toLowerCase().includes(q) ||
      (b.author || "").toLowerCase().includes(q) ||
      (b.genre || "").toLowerCase().includes(q);
    const available = b.availableCopies > 0;
    const matchStatus = !status ||
      (status === "available" && available) ||
      (status === "issued" && !available);
    return matchQ && matchStatus;
  });
  renderInventory(filtered);
}

async function loadInventory() {
  const data = await api("/api/books");
  _allBooks = data.books;
  renderInventory(_allBooks);

  const issueSelect = document.getElementById("issueBookSelect");
  issueSelect.innerHTML = data.books
    .filter(b => b.availableCopies > 0)
    .map(b => `<option value="${b.id}">${escapeHtml(b.title)}</option>`)
    .join("") || `<option disabled>No books available to issue</option>`;
}

let _allMembers = [];
let _memberVisibleCount = 10;
let _currentFilteredMembers = [];

function renderMembers(members) {
  _currentFilteredMembers = members || [];
  const tbody = document.getElementById("membersBody");
  const wrapper = document.getElementById("memberShowMoreWrapper");
  const moreBtn = document.getElementById("memberShowMoreBtn");
  const lessBtn = document.getElementById("memberShowLessBtn");
  const countSpan = document.getElementById("memberShowMoreCount");

  if (!members.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">No members match your search.</td></tr>`;
    if (wrapper) wrapper.style.display = "none";
    return;
  }

  const displayed = members.slice(0, _memberVisibleCount);
  tbody.innerHTML = displayed.map(m => {
    const fineBadge = m.totalFinesPending > 0
      ? `<span class="status-issued">₹${m.totalFinesPending} fine</span>`
      : `<span style="color:var(--text-muted)">₹0</span>`;

    return `
      <tr>
        <td data-label="Name"><strong>${escapeHtml(m.name)}</strong></td>
        <td data-label="Email">${escapeHtml(m.email || "—")}</td>
        <td data-label="Active Borrowed">${m.borrowedCount}</td>
        <td data-label="Reservations">${m.reservedCount || 0}</td>
        <td data-label="Pending Fines">${fineBadge}</td>
        <td data-label="Action" class="action-cell">
          <button class="secondary view-member-history-btn" data-member-id="${m.id}">
            Manage
          </button>
          <button class="danger delete-member-btn" data-member-id="${m.id}" data-member-name="${escapeHtml(m.name)}">
            Remove
          </button>
        </td>
      </tr>`;
  }).join("");

  document.querySelectorAll(".view-member-history-btn").forEach(btn => {
    btn.addEventListener("click", () => openMemberModal(btn.dataset.memberId));
  });
  document.querySelectorAll(".delete-member-btn").forEach(btn => {
    btn.addEventListener("click", () => deleteMemberAdmin(btn.dataset.memberId, btn.dataset.memberName));
  });

  if (wrapper && countSpan) {
    wrapper.style.display = "flex";
    countSpan.textContent = `Showing ${displayed.length} of ${members.length} members`;

    if (moreBtn) {
      moreBtn.style.display = _memberVisibleCount < members.length ? "inline-flex" : "none";
    }
    if (lessBtn) {
      lessBtn.style.display = _memberVisibleCount > 10 ? "inline-flex" : "none";
    }
  }
}

function filterMembers(resetCount = true) {
  if (resetCount) _memberVisibleCount = 10;
  const q = (document.getElementById("memberSearch") ? document.getElementById("memberSearch").value : "").toLowerCase().trim();
  const filtered = _allMembers.filter(m => {
    return !q ||
      (m.name || "").toLowerCase().includes(q) ||
      (m.email || "").toLowerCase().includes(q);
  });
  renderMembers(filtered);
}

async function deleteMemberAdmin(memberId, memberName) {
  if (!confirm(`Are you sure you want to remove member "${memberName}" from the system?`)) return;
  try {
    const res = await api("/api/members/" + memberId, { method: "DELETE" });
    await refreshAll();
  } catch (e) {
    alert(e.message);
  }
}

async function loadMembers() {
  const data = await api("/api/members");
  _allMembers = data.members || [];
  renderMembers(_allMembers);

  const memberSelect = document.getElementById("issueMemberSelect");
  if (memberSelect) {
    memberSelect.innerHTML = _allMembers
      .map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`)
      .join("");
  }
}

async function openMemberModal(memberId) {
  const modal = document.getElementById("memberDetailsModal");
  const modalBody = document.getElementById("modalMemberBody");
  const modalName = document.getElementById("modalMemberName");
  const modalEmail = document.getElementById("modalMemberEmail");
  const modalMsg = document.getElementById("modalMemberMsg");

  if (!modal) return;
  if (modalMsg) modalMsg.style.display = "none";
  modalName.textContent = "Loading Member Details...";
  modalEmail.textContent = "";
  modalBody.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);">Loading member history details…</div>`;
  modal.style.display = "flex";

  try {
    const data = await api(`/api/members/${memberId}/history`);
    const m = data.member;
    const loansList = data.loans || [];

    modalName.textContent = m.name;
    modalEmail.textContent = m.email || "No email listed";

    const activeLoans = loansList.filter(l => l.status === "borrowed" || l.status === "overdue");
    const activeRes = loansList.filter(l => l.status === "reserved" || l.status === "on-hold");
    const pastLoans = loansList.filter(l => l.status === "returned");

    let html = `
      <div class="member-detail-summary" style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
        <div class="info-tile" style="flex:1;min-width:120px;">
          <span class="info-tile-num">${activeLoans.length}</span>
          <span class="info-tile-label">Currently Borrowed</span>
        </div>
        <div class="info-tile" style="flex:1;min-width:120px;">
          <span class="info-tile-num">${activeRes.length}</span>
          <span class="info-tile-label">Active Reservations</span>
        </div>
        <div class="info-tile" style="flex:1;min-width:120px;">
          <span class="info-tile-num">${loansList.length}</span>
          <span class="info-tile-label">Total History Loans</span>
        </div>
      </div>

      <h4 style="margin: 16px 0 8px;font-size:1.05rem;">Active Borrowed Books &amp; Overdue</h4>`;

    if (!activeLoans.length) {
      html += `<p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:16px;">No currently borrowed books.</p>`;
    } else {
      html += `
        <table style="margin-bottom:20px;">
          <thead>
            <tr>
              <th>Title</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Fine</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${activeLoans.map(l => {
        const isOverdue = l.status === "overdue";
        return `
                <tr>
                  <td data-label="Title">${escapeHtml(l.bookTitle)}</td>
                  <td data-label="Due Date">${escapeHtml(l.dueDate || "—")}</td>
                  <td data-label="Status"><span class="${isOverdue ? "status-issued" : "status-available"}">${isOverdue ? "Overdue" : "Borrowed"}</span></td>
                  <td data-label="Fine">₹${l.fine || 0}</td>
                  <td data-label="Action" class="action-cell">
                    <button class="return-loan-modal-btn secondary" data-loan-id="${l.id}">Return Book</button>
                    ${l.fine > 0 ? `<button class="pay-fine-modal-btn primary" data-loan-id="${l.id}">Clear Fine</button>` : ""}
                  </td>
                </tr>`;
      }).join("")}
          </tbody>
        </table>`;
    }

    html += `<h4 style="margin: 16px 0 8px;font-size:1.05rem;">Active Reservations</h4>`;
    if (!activeRes.length) {
      html += `<p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:16px;">No active reservations.</p>`;
    } else {
      html += `
        <table style="margin-bottom:20px;">
          <thead>
            <tr>
              <th>Book Title</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${activeRes.map(r => {
        const canIssue = r.status === "on-hold" || r.availableCopies > 0;
        return `
                <tr>
                  <td data-label="Title">${escapeHtml(r.bookTitle)}</td>
                  <td data-label="Status"><span class="status-reserved">${r.status === "on-hold" ? "On hold for pickup" : "Reserved"}</span></td>
                  <td data-label="Action" class="action-cell">
                    <button class="issue-res-modal-btn primary" data-loan-id="${r.id}" ${canIssue ? "" : "disabled"}>Issue Book</button>
                    <button class="cancel-res-modal-btn danger" data-loan-id="${r.id}">Cancel</button>
                  </td>
                </tr>`;
      }).join("")}
          </tbody>
        </table>`;
    }

    html += `<h4 style="margin: 16px 0 8px;font-size:1.05rem;">Borrowing History (${pastLoans.length} past items)</h4>`;
    if (!pastLoans.length) {
      html += `<p style="color:var(--text-muted);font-size:0.88rem;">No past completed loans recorded.</p>`;
    } else {
      html += `
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Borrowed Date</th>
              <th>Returned Date</th>
            </tr>
          </thead>
          <tbody>
            ${pastLoans.map(p => `
              <tr>
                <td data-label="Title">${escapeHtml(p.bookTitle)}</td>
                <td data-label="Borrowed Date">${escapeHtml(p.borrowDate || "—")}</td>
                <td data-label="Returned Date">${escapeHtml(p.returnDate || "—")}</td>
              </tr>`).join("")}
          </tbody>
        </table>`;
    }

    modalBody.innerHTML = html;

    // Wire actions inside modal
    document.querySelectorAll(".return-loan-modal-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        try {
          await api("/api/loans/return", { method: "POST", body: JSON.stringify({ loanId: btn.dataset.loanId }) });
          showMsg("modalMemberMsg", "Book returned successfully.", true);
          await refreshAll();
          openMemberModal(memberId);
        } catch (e) {
          showMsg("modalMemberMsg", e.message, false);
        }
      });
    });

    document.querySelectorAll(".pay-fine-modal-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        try {
          await api("/api/loans/pay-fine", { method: "POST", body: JSON.stringify({ loanId: btn.dataset.loanId }) });
          showMsg("modalMemberMsg", "Fine cleared.", true);
          await refreshAll();
          openMemberModal(memberId);
        } catch (e) {
          showMsg("modalMemberMsg", e.message, false);
        }
      });
    });

    document.querySelectorAll(".issue-res-modal-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        try {
          await api("/api/loans/issue-reservation", { method: "POST", body: JSON.stringify({ loanId: btn.dataset.loanId }) });
          showMsg("modalMemberMsg", "Reserved book issued to member.", true);
          await refreshAll();
          openMemberModal(memberId);
        } catch (e) {
          showMsg("modalMemberMsg", e.message, false);
        }
      });
    });

    document.querySelectorAll(".cancel-res-modal-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Cancel this reservation?")) return;
        try {
          await api(`/api/loans/admin-reservation/${btn.dataset.loanId}`, { method: "DELETE" });
          showMsg("modalMemberMsg", "Reservation cancelled.", true);
          await refreshAll();
          openMemberModal(memberId);
        } catch (e) {
          showMsg("modalMemberMsg", e.message, false);
        }
      });
    });

  } catch (e) {
    modalBody.innerHTML = `<div style="color:red;padding:16px;">Failed to load member history: ${escapeHtml(e.message)}</div>`;
  }
}

function closeMemberModal() {
  const modal = document.getElementById("memberDetailsModal");
  if (modal) modal.style.display = "none";
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

async function loadPayments() {
  const data = await api("/api/loans/payments");
  const tbody = document.getElementById("paymentsBody");
  const rows = data.payments || [];
  tbody.innerHTML = rows.length
    ? rows.map(p => `
      <tr>
        <td data-label="Loan ID">${p.loanId ?? "—"}</td>
        <td data-label="Member ID">${p.memberId ?? "—"}</td>
        <td data-label="Amount">₹${p.amount ?? 0}</td>
        <td data-label="Paid At">${escapeHtml(fmtDate(p.paidAt))}</td>
      </tr>`).join("")
    : `<tr><td colspan="4">No payments yet.</td></tr>`;
}

async function loadAuditLogs() {
  const data = await api("/api/loans/audit-logs");
  const tbody = document.getElementById("auditBody");
  const rows = data.logs || [];
  tbody.innerHTML = rows.length
    ? rows.map(l => `
      <tr>
        <td data-label="When">${escapeHtml(fmtDate(l.createdAt))}</td>
        <td data-label="Action">${escapeHtml(l.action || "—")}</td>
        <td data-label="Actor">${escapeHtml(`${l.userType || "system"}:${l.userId ?? "—"}`)}</td>
        <td data-label="Target">${escapeHtml(`${l.targetType || "—"}:${l.targetId ?? "—"}`)}</td>
      </tr>`).join("")
    : `<tr><td colspan="4">No audit entries yet.</td></tr>`;
}

async function loadReturnableLoans() {
  const data = await api("/api/loans");
  const active = data.loans.filter(l => l.status === "borrowed" || l.status === "overdue");
  const select = document.getElementById("returnLoanSelect");
  select.innerHTML = active.length
    ? active.map(l => `<option value="${l.id}">${escapeHtml(l.bookTitle)} (${escapeHtml(l.memberName)})</option>`).join("")
    : `<option disabled>No active loans to return</option>`;
}

async function loadReservationsAdmin() {
  try {
    const data = await api("/api/loans/reservations");
    const list = data.reservations || [];
    const tbody = document.getElementById("reservationsAdminBody");
    const badgeCount = document.getElementById("resBadgeCount");
    if (badgeCount) badgeCount.textContent = list.length;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">No active member reservations.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(r => {
      const isAvailable = r.status === "on-hold" || r.availableCopies > 0;
      const copyBadge = isAvailable
        ? `<span class="status-available">Available (${r.availableCopies || 1} copy)</span>`
        : `<span class="status-issued">All Copies Out (0 available)</span>`;

      return `
        <tr>
          <td data-label="Member Name">${escapeHtml(r.memberName)}</td>
          <td data-label="Member Email">${escapeHtml(r.memberEmail || "—")}</td>
          <td data-label="Book Title">${escapeHtml(r.bookTitle)}</td>
          <td data-label="Copy Status">${copyBadge}</td>
          <td data-label="Action" class="action-cell">
            <button class="primary issue-res-btn" data-loan-id="${r.id}" ${isAvailable ? "" : "disabled title='No available copies right now'"}>
              Issue to Member
            </button>
            <button class="danger cancel-res-btn" data-loan-id="${r.id}">
              Cancel
            </button>
          </td>
        </tr>`;
    }).join("");

    document.querySelectorAll(".issue-res-btn").forEach(btn => {
      btn.addEventListener("click", () => issueReservationAdmin(btn.dataset.loanId));
    });
    document.querySelectorAll(".cancel-res-btn").forEach(btn => {
      btn.addEventListener("click", () => cancelReservationAdmin(btn.dataset.loanId));
    });
  } catch (e) {
    const tbody = document.getElementById("reservationsAdminBody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="5">Failed to load reservations.</td></tr>`;
  }
}

async function issueReservationAdmin(loanId) {
  try {
    const res = await api("/api/loans/issue-reservation", {
      method: "POST",
      body: JSON.stringify({ loanId })
    });
    showMsg("reservationAdminMsg", res.message || "Reservation issued to member.", true);
    await refreshAll();
  } catch (e) {
    showMsg("reservationAdminMsg", e.message, false);
  }
}

async function cancelReservationAdmin(loanId) {
  if (!confirm("Cancel this member reservation?")) return;
  try {
    const res = await api("/api/loans/admin-reservation/" + loanId, { method: "DELETE" });
    showMsg("reservationAdminMsg", res.message || "Reservation cancelled.", true);
    await refreshAll();
  } catch (e) {
    showMsg("reservationAdminMsg", e.message, false);
  }
}

async function refreshAll() {
  await Promise.all([
    loadDashboard(),
    loadInventory(),
    loadReservationsAdmin(),
    loadMembers(),
    loadReturnableLoans(),
    loadPayments(),
    loadAuditLogs()
  ]);
}

document.getElementById("addBookForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("newTitle").value.trim();
  const author = document.getElementById("newAuthor").value.trim();
  const genre = document.getElementById("newGenre").value.trim();
  const branch = document.getElementById("newBranch").value.trim();
  const format = document.getElementById("newFormat").value.trim();
  const totalCopies = document.getElementById("newCopies").value;
  const editingBookId = document.getElementById("editingBookId").value;

  if (!title || !author) return showMsg("addBookMsg", "Title and author are required.", false);

  const body = {
    title,
    author,
    genre,
    branch,
    format: format || "Physical",
    totalCopies: Number(totalCopies || 1)
  };

  try {
    if (editingBookId) {
      await api(`/api/books/${editingBookId}`, { method: "PUT", body: JSON.stringify(body) });
      showMsg("addBookMsg", "Book updated in the catalog.", true);
    } else {
      await api("/api/books", { method: "POST", body: JSON.stringify(body) });
      showMsg("addBookMsg", "Book added to the catalog.", true);
    }
    resetBookForm();
    await refreshAll();
  } catch (err) {
    showMsg("addBookMsg", err.message, false);
  }
});

document.getElementById("issueForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const bookId = document.getElementById("issueBookSelect").value;
  const memberId = document.getElementById("issueMemberSelect").value;
  try {
    await api("/api/loans/issue", { method: "POST", body: JSON.stringify({ bookId, memberId }) });
    showMsg("issueMsg", "Book issued.", true);
    await refreshAll();
  } catch (err) {
    showMsg("issueMsg", err.message, false);
  }
});

document.getElementById("returnForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const loanId = document.getElementById("returnLoanSelect").value;
  if (!loanId) return showMsg("returnMsg", "No loan selected.", false);
  try {
    await api("/api/loans/return", { method: "POST", body: JSON.stringify({ loanId }) });
    showMsg("returnMsg", "Book returned.", true);
    await refreshAll();
  } catch (err) {
    showMsg("returnMsg", err.message, false);
  }
});

async function editBook(bookId) {
  try {
    const data = await api("/api/books/" + bookId);
    const book = data.book;
    document.getElementById("editingBookId").value = book.id;
    document.getElementById("newTitle").value = book.title || "";
    document.getElementById("newAuthor").value = book.author || "";
    document.getElementById("newGenre").value = book.genre || "";
    document.getElementById("newBranch").value = book.branch || "";
    document.getElementById("newFormat").value = book.format || "Physical";
    document.getElementById("newCopies").value = book.totalCopies || 1;
    document.getElementById("bookSubmitBtn").textContent = "Save Changes";
    document.getElementById("bookFormTitle").textContent = "Edit Book";
    document.getElementById("cancelEditBtn").style.display = "inline-block";
    document.getElementById("newTitle").focus();
  } catch (e) {
    showMsg("addBookMsg", e.message, false);
  }
}

async function deleteBook(bookId) {
  if (!confirm("Delete this book from the catalog?")) return;
  try {
    await api("/api/books/" + bookId, { method: "DELETE" });
    showMsg("addBookMsg", "Book deleted from the catalog.", true);
    resetBookForm();
    await refreshAll();
  } catch (e) {
    showMsg("addBookMsg", e.message, false);
  }
}

document.getElementById("inventorySearch").addEventListener("input", () => {
  clearTimeout(window._invT);
  window._invT = setTimeout(() => filterInventory(true), 200);
});
document.getElementById("inventoryStatusFilter").addEventListener("change", () => filterInventory(true));

const invShowMoreBtn = document.getElementById("invShowMoreBtn");
if (invShowMoreBtn) {
  invShowMoreBtn.addEventListener("click", () => {
    _invVisibleCount += 5;
    renderInventory(_currentFilteredBooks);
  });
}

const invShowLessBtn = document.getElementById("invShowLessBtn");
if (invShowLessBtn) {
  invShowLessBtn.addEventListener("click", () => {
    _invVisibleCount = Math.max(10, _invVisibleCount - 5);
    renderInventory(_currentFilteredBooks);
  });
}

function initSidebarNav() {
  const sidebarBtns = document.querySelectorAll(".sidebar-btn");
  sidebarBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      sidebarBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".admin-tab-content").forEach(tab => {
        tab.classList.remove("active");
      });
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.classList.add("active");
    });
  });
}

const memberSearchEl = document.getElementById("memberSearch");
if (memberSearchEl) {
  memberSearchEl.addEventListener("input", () => {
    clearTimeout(window._memT);
    window._memT = setTimeout(() => filterMembers(true), 200);
  });
}

const memberShowMoreBtn = document.getElementById("memberShowMoreBtn");
if (memberShowMoreBtn) {
  memberShowMoreBtn.addEventListener("click", () => {
    _memberVisibleCount += 5;
    renderMembers(_currentFilteredMembers);
  });
}

const memberShowLessBtn = document.getElementById("memberShowLessBtn");
if (memberShowLessBtn) {
  memberShowLessBtn.addEventListener("click", () => {
    _memberVisibleCount = Math.max(10, _memberVisibleCount - 5);
    renderMembers(_currentFilteredMembers);
  });
}

const closeMemberModalBtn = document.getElementById("closeMemberModalBtn");
if (closeMemberModalBtn) {
  closeMemberModalBtn.addEventListener("click", closeMemberModal);
}
const memberModalOverlay = document.getElementById("memberDetailsModal");
if (memberModalOverlay) {
  memberModalOverlay.addEventListener("click", (e) => {
    if (e.target === memberModalOverlay) closeMemberModal();
  });
}

document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("cancelEditBtn").addEventListener("click", resetBookForm);

async function enterPanel() {
  const librarian = await checkSession();
  if (!librarian) return;
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("panelSection").style.display = "block";
  document.getElementById("librarianNameLabel").textContent = librarian.name;
  initSidebarNav();
  await refreshAll();
}

(async function init() {
  const librarian = await checkSession();
  if (librarian) await enterPanel();
})();