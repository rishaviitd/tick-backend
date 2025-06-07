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

module.exports = router;
