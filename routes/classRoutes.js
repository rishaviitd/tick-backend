/**
 * Class Routes
 * Routes for managing classroom operations
 */
const express = require("express");
const classController = require("../controllers/classController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Protect all class routes with authentication
router.use(authMiddleware);

// Create a class
router.post("/", classController.createClass);

// Get all classes for a teacher
router.get("/", classController.getTeacherClasses);

// Get all students in a class
router.get("/students", classController.getClassStudents);

// Get all assignments for a class
router.get("/:classId/assignments", classController.getClassAssignments);

module.exports = router;
