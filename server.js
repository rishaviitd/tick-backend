/**
 * Main Server File
 * Entry point for the backend application
 */
const express = require("express");
const cors = require("cors");
const connectDatabase = require("./config/database");
const config = require("./config/env");

// Import routes
const authRoutes = require("./routes/authRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const classRoutes = require("./routes/classRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const draftRoutes = require("./routes/draftRoutes");
const aiGradingRoutes = require("./routes/aiGradingRoutes");

// Initialize express app
const app = express();

// Middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  next();
});

// Connect to database
connectDatabase()
  .then(() => {
    console.log("Database connection established.");
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });

// Root route
app.get("/", (req, res) => {
  res.send("Crita - Assessment Platform API");
});

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/teachers", teacherRoutes);
app.use("/api/v1/classes", classRoutes);
app.use("/api/v1/assignments", assignmentRoutes);
app.use("/api/v1/drafts", draftRoutes);
app.use("/api/v1/ai-grading", aiGradingRoutes);

// Start server
const port = config.PORT;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
  console.log(`Frontend URL: ${config.FRONTEND_URL}`);
  console.log(`Google Redirect URI: ${config.GOOGLE_REDIRECT_URI}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
  console.log("Shutting down server...");

  // Close server & exit process
  process.exit(1);
});

module.exports = app;
