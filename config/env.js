/**
 * Environment configuration
 * This file configures environment variables and app settings
 */
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables from .env file
dotenv.config();

// Determine environment mode
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

// Set port based on environment: 3000 for development, 80 for production (or override with PORT env var)
const PORT = isProduction ? process.env.PORT || 80 : process.env.PORT || 3000;

// Default configuration values
const config = {
  NODE_ENV,
  isProduction,
  PORT,
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
