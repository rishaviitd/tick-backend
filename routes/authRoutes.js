/**
 * Authentication Routes
 * Routes for user authentication (signup, login, OAuth)
 */
const express = require("express");
const { body } = require("express-validator");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const cors = require("cors");

const router = express.Router();

// Get CORS options from server
const getCorsOptions = () => {
  return {
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
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"],
    credentials: true,
    optionsSuccessStatus: 200,
  };
};

// Validation middleware for signup
const signupValidation = [
  body("email").isEmail().withMessage("Please enter a valid email"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
];

// Register a new user
router.post("/signup", signupValidation, authController.signup);

// Login a user
router.post("/login", authController.login);

// Google authentication routes
router.get("/google", authController.googleAuth);
router.get("/google/callback", authController.googleOAuthCallback);
router.post("/google/callback", authController.googleCallback);

// Apply CORS options specifically for the verify endpoint
router.options("/verify", cors(getCorsOptions()));
router.get(
  "/verify",
  cors(getCorsOptions()),
  authMiddleware,
  authController.verifyToken
);

module.exports = router;
