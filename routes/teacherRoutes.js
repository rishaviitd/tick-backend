/**
 * Teacher Routes
 * Routes for teacher management
 */
const express = require("express");
const teacherController = require("../controllers/teacherController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Create a teacher
router.post("/", teacherController.createTeacher);

// Get a teacher by ID with detailed information
router.get("/:id", teacherController.getTeacherById);

module.exports = router;
