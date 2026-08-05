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

function renderInventory(books) {
  const tbody = document.getElementById("inventoryBody");
  if (!books.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;">No books match your search.</td></tr>`;
    return;
  }
  tbody.innerHTML = books.map(b => {
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
}

function filterInventory() {
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

async function loadMembers() {
  const data = await api("/api/members");
  const tbody = document.getElementById("membersBody");
  tbody.innerHTML = data.members.map(m => `
    <tr>
      <td data-label="Name">${escapeHtml(m.name)}</td>
      <td data-label="Borrowed">${m.borrowedCount}</td>
    </tr>`).join("");

  const memberSelect = document.getElementById("issueMemberSelect");
  memberSelect.innerHTML = data.members
    .map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`)
    .join("");
}

async function loadReturnableLoans() {
  const data = await api("/api/loans");
  const active = data.loans.filter(l => l.status === "borrowed" || l.status === "overdue");
  const select = document.getElementById("returnLoanSelect");
  select.innerHTML = active.length
    ? active.map(l => `<option value="${l.id}">${escapeHtml(l.bookTitle)} (${escapeHtml(l.memberName)})</option>`).join("")
    : `<option disabled>No active loans to return</option>`;
}

async function refreshAll() {
  await Promise.all([loadDashboard(), loadInventory(), loadMembers(), loadReturnableLoans()]);
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
  window._invT = setTimeout(filterInventory, 200);
});
document.getElementById("inventoryStatusFilter").addEventListener("change", filterInventory);

document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("cancelEditBtn").addEventListener("click", resetBookForm);

async function enterPanel() {
  const librarian = await checkSession();
  if (!librarian) return;
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("panelSection").style.display = "block";
  document.getElementById("librarianNameLabel").textContent = librarian.name;
  await refreshAll();
}

(async function init() {
  const librarian = await checkSession();
  if (librarian) await enterPanel();
})();