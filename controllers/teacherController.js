/**
 * Teacher Controller
 * Handles operations related to teacher management
 */
const Teacher = require("../models/teacherModel");

/**
 * Create a new teacher
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createTeacher = async (req, res) => {
  try {
    const { full_name, password, email } = req.body;

    // Basic validation
    if (!full_name || !password || !email) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if email already exists
    const existingTeacher = await Teacher.findOne({ email });

    if (existingTeacher) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    // Create new teacher
    const newTeacher = await Teacher.create({
      full_name,
      email,
      password,
    });

    res.status(201).json({
      message: "Teacher created successfully",
      data: {
        full_name: newTeacher.full_name,
        email: newTeacher.email,
      },
    });
  } catch (error) {
    console.error("Error creating teacher:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * Get all teachers
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */

/**
 * Get a teacher by ID with detailed information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTeacherById = async (req, res) => {
  const { id } = req.params;

  try {
    // Find teacher by ID and populate related data
    const teacher = await Teacher.findById(id)
      .populate({
        path: "classes",
        select: "title students assignments",
        populate: [
          {
            path: "students",
            select: "first_name last_name",
          },
          {
            path: "assignments",
            select: "title active questions",
            populate: {
              path: "questions",
              select: "text questionType rubric",
            },
          },
        ],
      })
      .select("first_name last_name email username classes");

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher not found",
      });
    }

    res.status(200).json({
      message: "Teacher fetched successfully",
      data: teacher,
    });
  } catch (err) {
    console.error("Error fetching teacher by ID:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
