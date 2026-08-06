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

function formatValue(book) {
  return book.format.includes("E-Book")
    ? `Physical <span class="badge">E-Book</span>`
    : escapeHtml(book.format);
}

function rowHtml(book) {
  const available = book.availableCopies > 0;
  const statusText = available ? "Available" : "Issued";
  const statusClass = available ? "status-available" : "status-issued";
  const actionCell = available
    ? `<button data-book-id="${book.id}" class="reserve-btn">Reserve</button>`
    : `—`;
  return `
    <tr>
      <td data-label="Title">${escapeHtml(book.title)}</td>
      <td data-label="Author">${escapeHtml(book.author)}</td>
      <td data-label="Genre">${escapeHtml(book.genre)}</td>
      <td data-label="Branch">${escapeHtml(book.branch)}</td>
      <td data-label="Format">${formatValue(book)}</td>
      <td data-label="Status"><span class="${statusClass}">${statusText}</span></td>
      <td data-label="Action">${actionCell} <span class="qrTag">QR: ${escapeHtml(book.qr)}</span></td>
    </tr>
  `;
}

let visibleCount = 10;
let allFetchedBooks = [];

function renderTable() {
  const tbody = document.getElementById("bookTableBody");
  const wrapper = document.getElementById("showMoreWrapper");
  const moreBtn = document.getElementById("showMoreBtn");
  const lessBtn = document.getElementById("showLessBtn");
  const countSpan = document.getElementById("showMoreCount");

  if (!allFetchedBooks.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="empty-state-icon">📭</span>No books match your search.<br><small>Try a different title, author or filter.</small></div></td></tr>`;
    if (wrapper) wrapper.style.display = "none";
    return;
  }

  const displayed = allFetchedBooks.slice(0, visibleCount);
  tbody.innerHTML = displayed.map(rowHtml).join("");

  document.querySelectorAll(".reserve-btn").forEach(btnEl => {
    btnEl.addEventListener("click", () => reserveBook(btnEl.dataset.bookId, btnEl));
  });

  if (wrapper && countSpan) {
    wrapper.style.display = "flex";
    countSpan.textContent = `Showing ${displayed.length} of ${allFetchedBooks.length} books`;

    if (moreBtn) {
      moreBtn.style.display = visibleCount < allFetchedBooks.length ? "inline-flex" : "none";
    }
    if (lessBtn) {
      lessBtn.style.display = visibleCount > 10 ? "inline-flex" : "none";
    }
  }
}

async function loadBooks(resetPagination = true) {
  if (resetPagination) {
    visibleCount = 10;
  }

  const q = document.getElementById("searchInput").value.trim();
  const genre = document.getElementById("genreFilter").value;
  const status = document.getElementById("statusFilter").value;

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (genre) params.set("genre", genre);
  if (status) params.set("status", status);

  const data = await api("/api/books?" + params.toString());
  allFetchedBooks = data.books || [];

  // Update info strip
  const total = allFetchedBooks.length;
  const avail = allFetchedBooks.filter(b => b.availableCopies > 0).length;
  const issued = total - avail;
  const genres = new Set(allFetchedBooks.map(b => b.genre).filter(Boolean)).size;
  document.getElementById('stripTotal').textContent = total;
  document.getElementById('stripAvailable').textContent = avail;
  document.getElementById('stripIssued').textContent = issued;
  document.getElementById('stripGenres').textContent = genres || '—';

  renderTable();
}

function showMsg(text, ok) {
  const el = document.getElementById("reserveMsg");
  el.textContent = text;
  el.className = "msg " + (ok ? "success" : "error");
  el.style.display = "block";
}

async function reserveBook(bookId, btn) {
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Reserving…";
  try {
    await api("/api/loans/reserve", { method: "POST", body: JSON.stringify({ bookId }) });
    showMsg("✅ Reserved! Check My Reservations in the Member Portal.", true);
    await loadBooks(false);
  } catch (e) {
    showMsg(e.message.includes("log in") ? "🔒 Please log in on the Member Portal to reserve books." : e.message, false);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

document.getElementById("searchInput").addEventListener("input", () => {
  clearTimeout(window._t);
  window._t = setTimeout(() => loadBooks(true), 250);
});
document.getElementById("genreFilter").addEventListener("change", () => loadBooks(true));
document.getElementById("statusFilter").addEventListener("change", () => loadBooks(true));

const showMoreBtn = document.getElementById("showMoreBtn");
if (showMoreBtn) {
  showMoreBtn.addEventListener("click", () => {
    visibleCount += 5;
    renderTable();
  });
}
const showLessBtn = document.getElementById("showLessBtn");
if (showLessBtn) {
  showLessBtn.addEventListener("click", () => {
    visibleCount = Math.max(10, visibleCount - 5);
    renderTable();
  });
}

loadBooks(true);