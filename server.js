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

// CORS Configuration
const corsOptions = {
  origin: [
    // Production domains
    "https://usetick.com",
    "https://www.usetick.com",
    "https://app.usetick.com",
    "https://www.app.usetick.com",
    // Development domains (keep for testing)
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://localhost:8081",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Middleware
app.use(express.json());

// Enhanced logging middleware
app.use((req, res, next) => {
  const startTime = new Date();
  const oldSend = res.send;
  const oldJson = res.json;

  // Store request details
  const requestLog = {
    endpoint: `${req.method} ${req.originalUrl}`,
    input: {
      body: req.body,
      query: req.query,
      params: req.params,
    },
  };

  // Override send
  res.send = function (body) {
    const responseTime = new Date() - startTime;

    console.log("\n//////////////////////");
    console.log(`${requestLog.endpoint}`);
    console.log(`Input: ${JSON.stringify(requestLog.input, null, 2)}`);
    console.log(`Response: ${body}`);
    console.log(`Response Time: ${responseTime}ms`);
    console.log("////////////////////////\n");

    return oldSend.apply(res, arguments);
  };

  // Override json
  res.json = function (body) {
    const responseTime = new Date() - startTime;

    console.log("\n//////////////////////");
    console.log(`${requestLog.endpoint}`);
    console.log(`Input: ${JSON.stringify(requestLog.input, null, 2)}`);
    console.log(`Response: ${JSON.stringify(body, null, 2)}`);
    console.log(`Response Time: ${responseTime}ms`);
    console.log("////////////////////////\n");

    return oldJson.apply(res, arguments);
  };

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

// Debug route for auth verification - can help diagnose issues
app.get("/api/v1/auth/verify-debug", (req, res) => {
  console.log("\n//////////////////////");
  console.log("DEBUG AUTH VERIFY ENDPOINT HIT");
  console.log(`Headers: ${JSON.stringify(req.headers, null, 2)}`);
  console.log("////////////////////////\n");

  res.status(200).json({
    success: true,
    message: "Debug endpoint reached successfully",
    headers: req.headers,
  });
});

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
