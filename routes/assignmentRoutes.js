/**
 * Assignment Routes
 * Routes for assignment and draft management
 */
const express = require("express");
const assignmentController = require("../controllers/assignmentController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Protect all assignment routes with authentication
router.use(authMiddleware);

// Create a new assignment
router.post("/", assignmentController.createAssignment);

// Update an existing assignment
router.put("/:assignmentId", assignmentController.updateAssignment);

// Draft routes - IMPORTANT: Place these BEFORE the dynamic :assignmentId routes
router.post("/drafts", assignmentController.saveDraft);
router.get("/drafts", assignmentController.getAllDrafts);
router.get("/drafts/:id", assignmentController.getDraftById);
router.delete("/drafts/:id", assignmentController.deleteDraft);

// Get assignment details
router.get("/:assignmentId", assignmentController.getAssignmentDetails);

// Get available students for an assignment
router.get(
  "/:assignmentId/availableStudents",
  assignmentController.getAvailableStudents
);

// Get rubric for a specific question in an assignment
router.get(
  "/:assignmentId/questions/:questionId/rubric",
  assignmentController.getQuestionRubric
);

// Save steps breakdown for a student's question response
router.post(
  "/:assignmentId/students/:studentId/questions/:questionId/stepsBreakdown",
  assignmentController.saveQuestionStepsBreakdown
);

// Student assignment management
router.put(
  "/:assignmentId/students/:studentId",
  assignmentController.updateStudentAssignment
);
router.post(
  "/:assignmentId/students/:studentId/retry",
  assignmentController.retryGrading
);

module.exports = router;
