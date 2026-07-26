// Dummy "database" for books — in-memory array.

let books = [
  { id: 1, title: "The Alchemist", author: "Paulo Coelho", genre: "Fiction", branch: "Main Campus Library", format: "Physical + E-Book", totalCopies: 3, availableCopies: 2, qr: "LIB-0001", timesBorrowed: 14 },
  { id: 2, title: "Clean Code", author: "Robert C. Martin", genre: "Technology", branch: "Main Campus Library", format: "Physical", totalCopies: 2, availableCopies: 2, qr: "LIB-0002", timesBorrowed: 6 },
  { id: 3, title: "Sapiens", author: "Yuval Noah Harari", genre: "History", branch: "North Branch", format: "Physical + E-Book", totalCopies: 3, availableCopies: 3, qr: "LIB-0003", timesBorrowed: 8 },
  { id: 4, title: "1984", author: "George Orwell", genre: "Fiction", branch: "Main Campus Library", format: "Physical", totalCopies: 2, availableCopies: 1, qr: "LIB-0004", timesBorrowed: 11 },
  { id: 5, title: "Atomic Habits", author: "James Clear", genre: "Self-Help", branch: "North Branch", format: "Physical", totalCopies: 4, availableCopies: 4, qr: "LIB-0005", timesBorrowed: 9 },
  { id: 6, title: "A Brief History of Time", author: "Stephen Hawking", genre: "Science", branch: "Main Campus Library", format: "Physical + E-Book", totalCopies: 2, availableCopies: 2, qr: "LIB-0006", timesBorrowed: 4 },
  { id: 7, title: "The Pragmatic Programmer", author: "Andrew Hunt", genre: "Technology", branch: "Main Campus Library", format: "Physical + E-Book", totalCopies: 3, availableCopies: 1, qr: "LIB-0007", timesBorrowed: 13 },
  { id: 8, title: "Rich Dad Poor Dad", author: "Robert Kiyosaki", genre: "Finance", branch: "South Branch", format: "Physical", totalCopies: 5, availableCopies: 3, qr: "LIB-0008", timesBorrowed: 18 },
  { id: 9, title: "The Psychology of Money", author: "Morgan Housel", genre: "Finance", branch: "North Branch", format: "Physical + E-Book", totalCopies: 4, availableCopies: 2, qr: "LIB-0009", timesBorrowed: 16 },
  { id: 10, title: "Deep Work", author: "Cal Newport", genre: "Productivity", branch: "Main Campus Library", format: "Physical", totalCopies: 3, availableCopies: 3, qr: "LIB-0010", timesBorrowed: 7 },
  { id: 11, title: "The Hobbit", author: "J.R.R. Tolkien", genre: "Fantasy", branch: "South Branch", format: "Physical + E-Book", totalCopies: 4, availableCopies: 1, qr: "LIB-0011", timesBorrowed: 21 },
  { id: 12, title: "Harry Potter and the Sorcerer's Stone", author: "J.K. Rowling", genre: "Fantasy", branch: "Main Campus Library", format: "Physical", totalCopies: 6, availableCopies: 5, qr: "LIB-0012", timesBorrowed: 27 },
  { id: 13, title: "The Lean Startup", author: "Eric Ries", genre: "Business", branch: "North Branch", format: "Physical + E-Book", totalCopies: 2, availableCopies: 1, qr: "LIB-0013", timesBorrowed: 10 },
  { id: 14, title: "Thinking, Fast and Slow", author: "Daniel Kahneman", genre: "Psychology", branch: "Main Campus Library", format: "Physical", totalCopies: 3, availableCopies: 2, qr: "LIB-0014", timesBorrowed: 15 },
  { id: 15, title: "The Silent Patient", author: "Alex Michaelides", genre: "Thriller", branch: "South Branch", format: "Physical", totalCopies: 2, availableCopies: 2, qr: "LIB-0015", timesBorrowed: 5 },
  { id: 16, title: "To Kill a Mockingbird", author: "Harper Lee", genre: "Classic", branch: "Main Campus Library", format: "Physical + E-Book", totalCopies: 3, availableCopies: 0, qr: "LIB-0016", timesBorrowed: 22 },
  { id: 17, title: "The Great Gatsby", author: "F. Scott Fitzgerald", genre: "Classic", branch: "North Branch", format: "Physical", totalCopies: 2, availableCopies: 2, qr: "LIB-0017", timesBorrowed: 12 },
  { id: 18, title: "The Power of Habit", author: "Charles Duhigg", genre: "Self-Help", branch: "Main Campus Library", format: "Physical + E-Book", totalCopies: 4, availableCopies: 3, qr: "LIB-0018", timesBorrowed: 17 },
  { id: 19, title: "The Design of Everyday Things", author: "Don Norman", genre: "Design", branch: "South Branch", format: "Physical", totalCopies: 2, availableCopies: 1, qr: "LIB-0019", timesBorrowed: 9 },
  { id: 20, title: "Introduction to Algorithms", author: "Thomas H. Cormen", genre: "Technology", branch: "Main Campus Library", format: "Physical", totalCopies: 5, availableCopies: 4, qr: "LIB-0020", timesBorrowed: 20 },
  { id: 21, title: "The Catcher in the Rye", author: "J.D. Salinger", genre: "Classic", branch: "North Branch", format: "Physical", totalCopies: 3, availableCopies: 2, qr: "LIB-0021", timesBorrowed: 8 },
  { id: 22, title: "Educated", author: "Tara Westover", genre: "Biography", branch: "South Branch", format: "Physical + E-Book", totalCopies: 3, availableCopies: 1, qr: "LIB-0022", timesBorrowed: 14 },
  { id: 23, title: "The Midnight Library", author: "Matt Haig", genre: "Fiction", branch: "Main Campus Library", format: "Physical + E-Book", totalCopies: 4, availableCopies: 4, qr: "LIB-0023", timesBorrowed: 6 },
  { id: 24, title: "The Martian", author: "Andy Weir", genre: "Science Fiction", branch: "North Branch", format: "Physical", totalCopies: 3, availableCopies: 2, qr: "LIB-0024", timesBorrowed: 13 },
  { id: 25, title: "Zero to One", author: "Peter Thiel", genre: "Business", branch: "South Branch", format: "Physical + E-Book", totalCopies: 2, availableCopies: 1, qr: "LIB-0025", timesBorrowed: 11 },
  { id: 26, title: "Can't Hurt Me", author: "David Goggins", genre: "Motivation", branch: "Main Campus Library", format: "Physical", totalCopies: 5, availableCopies: 3, qr: "LIB-0026", timesBorrowed: 19 },
  { id: 27, title: "The Art of War", author: "Sun Tzu", genre: "Philosophy", branch: "North Branch", format: "Physical + E-Book", totalCopies: 4, availableCopies: 2, qr: "LIB-0027", timesBorrowed: 25 },
  { id: 28, title: "Dune", author: "Frank Herbert", genre: "Science Fiction", branch: "South Branch", format: "Physical", totalCopies: 3, availableCopies: 1, qr: "LIB-0028", timesBorrowed: 18 },
  { id: 29, title: "The 7 Habits of Highly Effective People", author: "Stephen R. Covey", genre: "Self-Help", branch: "Main Campus Library", format: "Physical + E-Book", totalCopies: 4, availableCopies: 4, qr: "LIB-0029", timesBorrowed: 16 },
  { id: 30, title: "The Lord of the Rings", author: "J.R.R. Tolkien", genre: "Fantasy", branch: "North Branch", format: "Physical", totalCopies: 5, availableCopies: 2, qr: "LIB-0030", timesBorrowed: 30 }
];

let nextId = books.length + 1;

function getAll() {
  return books;
}

function getById(id) {
  return books.find(b => b.id === Number(id));
}

function create({ title, author, genre, branch, format, totalCopies }) {
  const copies = Number(totalCopies) > 0 ? Number(totalCopies) : 1;
  const book = {
    id: nextId++,
    title,
    author,
    genre: genre || "General",
    branch: branch || "Main Campus Library",
    format: format || "Physical",
    totalCopies: copies,
    availableCopies: copies,
    qr: `LIB-${String(nextId - 1).padStart(4, "0")}`,
    timesBorrowed: 0
  };
  books.push(book);
  return book;
}

function update(id, updates) {
  const book = getById(id);
  if (!book) return null;
  Object.assign(book, updates);
  return book;
}

function remove(id) {
  const idx = books.findIndex(b => b.id === Number(id));
  if (idx === -1) return false;
  books.splice(idx, 1);
  return true;
}

function decrementAvailable(id) {
  const book = getById(id);
  if (!book || book.availableCopies <= 0) return false;
  book.availableCopies -= 1;
  book.timesBorrowed += 1;
  return true;
}

function incrementAvailable(id) {
  const book = getById(id);
  if (!book) return false;
  if (book.availableCopies < book.totalCopies) book.availableCopies += 1;
  return true;
}

module.exports = { getAll, getById, create, update, remove, decrementAvailable, incrementAvailable };