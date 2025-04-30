/**
 * Authentication Routes
 * Routes for user authentication (signup, login, OAuth)
 */
const express = require("express");
const { body } = require("express-validator");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

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

// Verify token is valid
router.get("/verify", authMiddleware, authController.verifyToken);

module.exports = router;
