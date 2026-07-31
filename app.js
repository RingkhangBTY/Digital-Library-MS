require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const bookRoutes = require("./routes/bookRoutes");
const loanRoutes = require("./routes/loanRoutes");
const memberRoutes = require("./routes/memberRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const { initializeDatabase } = require("./data/db");

const app = express();
const PORT = process.env.PORT || 3000;
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("Missing required environment variable: SESSION_SECRET");
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 4, httpOnly: true } // 4 hours
  })
);

// API routes — all mounted through express.Router()
app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/analytics", analyticsRoutes);

// Static frontend — same folder as this file (index.html, member.html, admin.html, style.css)
app.use(express.static(path.join(__dirname, "public")));

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found." });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Internal server error." });
});

async function start() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`Digital Library Management System running at http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start Digital Library Management System:", err);
  process.exit(1);
});
