/**
 * AI Grading Routes
 * Routes for AI-assisted grading
 */
const express = require("express");
const aiGradingController = require("../controllers/aiGradingController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Protect all routes with authentication
router.use(authMiddleware);

// Start grading process
router.post(
  "/:assignmentId/students/:studentId/start",
  aiGradingController.startGrading
);

// Update grades from AI
router.put(
  "/:assignmentId/students/:studentId/update",
  aiGradingController.updateGrades
);

// Get submission status
router.get(
  "/:assignmentId/students/:studentId/status",
  aiGradingController.getSubmissionStatus
);

// Get detailed feedback
router.get(
  "/:assignmentId/students/:studentId/feedback",
  aiGradingController.getDetailedFeedback
);

module.exports = router;
