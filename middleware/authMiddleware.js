/**
 * Authentication Middleware
 * Verifies JWT tokens and protects routes that require authentication
 */
const jwt = require("jsonwebtoken");
const config = require("../config/env");

/**
 * Middleware to verify JWT token and authenticate user
 * Adds user information to the request object if valid
 */
const authMiddleware = (req, res, next) => {
  // Get token from header (check both x-auth-token and authorization headers)
  let token = req.header("x-auth-token");

  // If no token in x-auth-token, check authorization header
  if (!token) {
    const authHeader = req.header("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    }
  }

  // Log headers for debugging
  console.log("Auth middleware headers:", {
    token: token ? "Present" : "Missing",
    authHeader: req.header("authorization"),
    xAuthToken: req.header("x-auth-token"),
  });

  // Check if token exists
  if (!token) {
    console.log("No auth token provided");
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please log in.",
      code: "NO_TOKEN",
    });
  }

  try {
    // Verify token
    console.log("Verifying token:", token.substring(0, 15) + "...");
    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      console.log("Token expired:", {
        expiry: new Date(decoded.exp * 1000).toISOString(),
        now: new Date().toISOString(),
      });
      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please log in again.",
        code: "TOKEN_EXPIRED",
      });
    }

    // Log successful authentication
    console.log("User authenticated:", {
      userId: decoded.user.id,
      name: decoded.user.name,
      email: decoded.user.email,
    });

    // Add user information to request
    req.user = decoded.user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please log in again.",
        code: "TOKEN_EXPIRED",
      });
    } else if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token. Please log in again.",
        code: "INVALID_TOKEN",
      });
    }

    res.status(401).json({
      success: false,
      message: "Authentication failed. Please log in again.",
      code: "AUTH_FAILED",
    });
  }
};

module.exports = authMiddleware;
