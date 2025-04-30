/**
 * Authentication Controller
 * Handles user registration, login, token verification, and OAuth flows
 */
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { validationResult } = require("express-validator");
const Teacher = require("../models/teacherModel");
const config = require("../config/env");

// Initialize Google OAuth client
const googleClient = new OAuth2Client(config.GOOGLE_CLIENT_ID);

/**
 * Register a new user with email and password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.signup = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
      });
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await Teacher.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "Email is already registered",
      });
    }

    // For email/password signup, password is required
    if (!password) {
      return res.status(400).json({
        success: false,
        error: "Password is required for email signup",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new Teacher({
      name,
      email,
      password: hashedPassword,
    });

    // Save user to database
    await newUser.save();

    // Return user data (excluding password)
    const userData = {
      id: newUser._id,
      email: newUser.email,
      createdAt: newUser.createdAt,
    };

    console.log(userData);
    return res.status(201).json({
      success: true,
      data: userData,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error. Please try again later.",
    });
  }
};

/**
 * Login a user with email and password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    // Find user by email
    const user = await Teacher.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // If user has no password (Google OAuth user)
    if (!user.password) {
      return res.status(401).json({
        success: false,
        error: "Please login with Google",
      });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    // Create JWT payload
    const tokenPayload = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    };

    // Sign token
    const token = jwt.sign(tokenPayload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN,
    });

    // Return success with token and user data
    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};

/**
 * Verify Google OAuth credentials
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.googleCallback = async (req, res) => {
  try {
    console.log("Received Google One Tap credential");

    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        error: "Google credential is missing",
      });
    }

    // Verify the Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(400).json({
        success: false,
        error: "Invalid Google token",
      });
    }

    console.log("Google token verified, user info:", {
      email: payload.email,
      name: payload.name,
    });

    // Check if user exists
    let user = await Teacher.findOne({ email: payload.email });

    if (!user) {
      // Create new user if they don't exist
      user = await Teacher.create({
        name: payload.name,
        email: payload.email,
        googleId: payload.sub,
        isVerified: true, // Google accounts are already verified
      });
    }

    // Generate JWT token
    const tokenPayload = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    };

    console.log("Creating JWT token with payload:", tokenPayload);

    const token = jwt.sign(tokenPayload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN,
    });

    // Return user data with token
    return res.status(200).json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        name: user.name,
        token,
      },
    });
  } catch (error) {
    console.error("Google One Tap error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error processing Google authentication",
    });
  }
};

/**
 * Redirect to Google OAuth consent screen
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.googleAuth = (req, res) => {
  // Log the request for debugging
  console.log("Received Google OAuth request");
  console.log("Headers:", req.headers);

  try {
    // Build the Google OAuth URL
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${
      config.GOOGLE_CLIENT_ID
    }&redirect_uri=${encodeURIComponent(
      config.GOOGLE_REDIRECT_URI
    )}&response_type=code&scope=email%20profile&access_type=offline&prompt=consent`;

    console.log("Redirecting to Google OAuth:", googleAuthUrl);
    res.redirect(googleAuthUrl);
  } catch (error) {
    console.error("Error initiating Google OAuth:", error);
    res.redirect(`${config.FRONTEND_URL}/auth/error?error=oauth_init_failed`);
  }
};

/**
 * Handle Google OAuth callback
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.googleOAuthCallback = async (req, res) => {
  try {
    console.log("Received Google OAuth callback");
    console.log("Query params:", req.query);

    const { code } = req.query;

    if (!code) {
      console.error("Error: No authorization code provided");
      return res.redirect(`${config.FRONTEND_URL}/auth/error?error=no_code`);
    }

    // Exchange the code for tokens
    const tokenRequestBody = new URLSearchParams({
      code: code,
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      redirect_uri: config.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    });

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenRequestBody,
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Token exchange error details:", tokenData);
      return res.redirect(
        `${config.FRONTEND_URL}/auth/error?error=token_exchange_failed`
      );
    }

    // Get user info from Google
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    const userInfo = await userInfoResponse.json();

    if (!userInfoResponse.ok) {
      console.error("User info error:", userInfo);
      return res.status(400).json({
        success: false,
        error: "Failed to get user info",
      });
    }

    // Check if user exists
    let user = await Teacher.findOne({ email: userInfo.email });

    try {
      if (!user) {
        // Create new user if they don't exist
        const newUser = {
          name: userInfo.name,
          email: userInfo.email,
          googleId: userInfo.id,
          isVerified: true,
        };
        user = await Teacher.create(newUser);
      } else if (!user.name || user.name !== userInfo.name) {
        // Update existing user's name if it's missing or different
        user.name = userInfo.name;
        if (!user.googleId) {
          user.googleId = userInfo.id;
        }
        await user.save();
      }
    } catch (error) {
      console.error("Error creating/updating user:", error);
      return res.redirect(
        `${config.FRONTEND_URL}/auth/error?error=user_creation_failed`
      );
    }

    // Generate JWT token with complete user info
    const tokenPayload = {
      user: {
        id: user._id,
        name: user.name || userInfo.name,
        email: user.email,
      },
    };

    const token = jwt.sign(tokenPayload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRES_IN,
    });

    // Redirect to app with token only, let app handle user extraction from token
    res.redirect(
      `${config.APP_URL}/auth/callback?token=${encodeURIComponent(token)}`
    );
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    res.redirect(`${config.FRONTEND_URL}/auth/error`);
  }
};

/**
 * Verify if a user's token is valid
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.verifyToken = (req, res) => {
  // Log full verification details
  console.log("\n[Auth Controller] Token verification endpoint hit");
  console.log("[Auth Controller] Request headers:", {
    origin: req.headers.origin,
    host: req.headers.host,
    referer: req.headers.referer,
  });
  console.log("[Auth Controller] User from token:", {
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
  });

  // If we reach this point, the token is valid (authMiddleware passed)
  return res.status(200).json({
    success: true,
    message: "Token is valid",
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    },
  });
};
