/**
 * Class Controller
 * Handles operations related to classroom management
 */
const Class = require("../models/classModel");
const Teacher = require("../models/teacherModel");
const Student = require("../models/studentModel");
const Assignment = require("../models/assignmentModel");

/**
 * Create a new class with students
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createClass = async (req, res) => {
  try {
    const { title, teacherId, students } = req.body;

    // Validate request body
    if (
      !title ||
      !teacherId ||
      !Array.isArray(students) ||
      students.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "Title, teacherId, and students are required" });
    }

    // Check if teacher exists
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Check for duplicate mobile numbers before proceeding
    const mobileNumbers = students.map((student) => student.mobileNo);

    // First check internally if there are duplicates in the submitted data
    const duplicatesInRequest = mobileNumbers.filter(
      (item, index) => mobileNumbers.indexOf(item) !== index
    );

    if (duplicatesInRequest.length > 0) {
      return res.status(400).json({
        message: "Duplicate mobile numbers in your request",
        duplicates: duplicatesInRequest,
      });
    }

    // Check for duplicate roll numbers (ignoring empty ones)
    const nonEmptyRollNumbers = students
      .filter((student) => student.rollNo?.trim())
      .map((student) => student.rollNo.trim());

    // If we have roll numbers, check for duplicates within the submitted data
    if (nonEmptyRollNumbers.length > 0) {
      const duplicateRollNumbers = nonEmptyRollNumbers.filter(
        (item, index) => nonEmptyRollNumbers.indexOf(item) !== index
      );

      if (duplicateRollNumbers.length > 0) {
        return res.status(400).json({
          message: "Duplicate roll numbers in your request",
          duplicates: duplicateRollNumbers,
          type: "rollNo",
        });
      }
    }

    // Step 1: Create class (empty student list for now)
    const newClass = await Class.create({
      title,
      teacher: teacherId,
      students: [], // we'll push them after creation
      assignments: [],
    });

    // Step 2: Find existing students and create new ones if needed
    const studentIds = [];

    // Process each student - create a new student record for this class
    for (const student of students) {
      const { full_name, mobileNo, rollNo } = student;

      if (!full_name || !mobileNo) {
        throw new Error("Each student must have full_name and mobileNo");
      }

      // Create a new student entry for this class
      const newStudent = await Student.create({
        full_name,
        mobileNo,
        rollNo: rollNo ? rollNo.trim() : "", // Trim roll number if exists
        class: newClass._id,
      });

      studentIds.push(newStudent._id);
    }

    // Step 3: Push students into class
    newClass.students.push(...studentIds);
    await newClass.save();

    // Step 4: Push class into teacher
    teacher.classes.push(newClass._id);
    await teacher.save();

    res.status(201).json({
      message: "Class and students created successfully",
      data: {
        id: newClass._id,
        title: newClass.title,
        teacher: teacher.full_name,
        students: studentIds,
      },
    });
  } catch (error) {
    console.error("Error creating class and students:", error);

    // Special handling for MongoDB duplicate key errors
    if (error.code === 11000) {
      if (error.keyPattern?.rollNo && error.keyPattern?.class) {
        // This is a duplicate roll number within the same class
        return res.status(409).json({
          message: "Duplicate roll number within this class",
          duplicates: [error.keyValue.rollNo],
          type: "rollNo",
        });
      }
    }

    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

/**
 * Get all classes for a teacher
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTeacherClasses = async (req, res) => {
  try {
    const { teacher } = req.query;

    if (!teacher) {
      return res.status(400).json({ message: "Teacher ID is required" });
    }

    const classes = await Class.find({ teacher })
      .populate("teacher", "full_name")
      .populate("students", "full_name");

    if (classes.length === 0) {
      return res
        .status(404)
        .json({ message: "No classes found for this teacher" });
    }

    res.status(200).json({
      message: "Classes fetched successfully",
      data: classes,
    });
  } catch (error) {
    console.error("Error fetching classes:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * Get all students in a class
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getClassStudents = async (req, res) => {
  try {
    const { classId } = req.query;

    if (!classId) {
      return res.status(400).json({ message: "classId is required in query" });
    }

    const classWithStudents = await Class.findById(classId)
      .populate("students", "full_name mobileNo rollNo")
      .select("title students");

    if (!classWithStudents) {
      return res.status(404).json({ message: "Class not found" });
    }

    if (
      !classWithStudents.students ||
      classWithStudents.students.length === 0
    ) {
      return res
        .status(404)
        .json({ message: "No students found for this class" });
    }

    res.status(200).json({
      message: "Students fetched successfully",
      classTitle: classWithStudents.title,
      data: classWithStudents.students,
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * Get all assignments for a class
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getClassAssignments = async (req, res) => {
  try {
    const { classId } = req.params;

    if (!classId) {
      return res.status(400).json({
        success: false,
        message: "Class ID is required",
      });
    }

    // Check if class exists
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Fetch assignments with populated questions
    const assignments = await Assignment.find({
      _id: { $in: classData.assignments },
    }).populate("questions", "text maxMarks");

    res.status(200).json({
      success: true,
      message: "Assignments fetched successfully",
      data: assignments,
    });
  } catch (error) {
    console.error("Error fetching class assignments:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
