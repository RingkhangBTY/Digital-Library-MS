require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const bookRoutes = require("./routes/bookRoutes");
const loanRoutes = require("./routes/loanRoutes");
const memberRoutes = require("./routes/memberRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const { initializeDatabase, getDb } = require("./data/db");

const app = express();
const PORT = process.env.PORT || 3000;
const sessionSecret = process.env.SESSION_SECRET;
const isProduction = process.env.NODE_ENV === "production";

if (!sessionSecret) {
  throw new Error("Missing required environment variable: SESSION_SECRET");
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("trust proxy", 1);

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 4,
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax"
    }
  })
);

// API routes — all mounted through express.Router()
app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationRoutes);

// Static frontend — same folder as this file (index.html, member.html, admin.html, style.css)
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", async (req, res) => {
  try {
    const database = await getDb();
    await database.command({ ping: 1 });
    res.json({ status: "ok" });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({ status: "error", message: "Database connection unavailable." });
  }
});

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
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Digital Library Management System running at http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start Digital Library Management System:", err);
  process.exit(1);
});
