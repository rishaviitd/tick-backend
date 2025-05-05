/**
 * AI Grading Routes
 * Routes for AI-powered grading and assessment
 */
const express = require("express");
const aiGradingController = require("../controllers/aiGradingController");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/student-submissions/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

const router = express.Router();

// Protect all AI grading routes with authentication
router.use(authMiddleware);

// Start grading process
router.post(
  "/:assignmentId/students/:studentId/grade",
  aiGradingController.startGrading
);

// Upload submission file
router.post(
  "/:assignmentId/students/:studentId/upload",
  upload.single("submissionFile"),
  aiGradingController.uploadSubmission
);

// Update grades from AI processing
router.put(
  "/:assignmentId/students/:studentId/grades",
  aiGradingController.updateGrades
);

// Get submission status
router.get(
  "/:assignmentId/students/:studentId/status",
  aiGradingController.getSubmissionStatus
);

// Get detailed feedback for a student's assignment
router.get(
  "/:assignmentId/students/:studentId/feedback",
  aiGradingController.getDetailedFeedback
);

module.exports = router;
