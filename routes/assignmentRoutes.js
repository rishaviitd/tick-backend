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

// Get assignment details
router.get("/:assignmentId", assignmentController.getAssignmentDetails);

// Get available students for an assignment
router.get(
  "/:assignmentId/availableStudents",
  assignmentController.getAvailableStudents
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

// Draft routes
router.post("/drafts", assignmentController.saveDraft);
router.get("/drafts", assignmentController.getAllDrafts);
router.get("/drafts/:title", assignmentController.getDraftByTitle);
router.delete("/drafts/:title", assignmentController.deleteDraft);

module.exports = router;
