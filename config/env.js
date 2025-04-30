/**
 * Environment configuration
 * This file configures environment variables and app settings
 */
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables from .env file
dotenv.config();

// Default configuration values
const config = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || "your_jwt_secret_here",
  JWT_EXPIRES_IN: "24h",
  FRONTEND_URL: process.env.FRONTEND_URL,
  APP_URL: process.env.APP_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI:
    process.env.GOOGLE_REDIRECT_URI ||
    "http://localhost:3000/api/v1/auth/google/callback",
};

module.exports = config;
