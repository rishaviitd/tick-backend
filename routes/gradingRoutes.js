/**
 * Grading Routes
 * Routes for handling grading submissions
 */
const express = require("express");
const gradingController = require("../controllers/gradingController");
const multer = require("multer");

// Use memory storage for uploaded PDFs
const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

// Route for uploading PDF submissions
router.post(
  "/uploadSubmission",
  upload.single("file"),
  gradingController.uploadSubmission
);

module.exports = router;
