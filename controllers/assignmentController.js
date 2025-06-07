/**
 * Assignment Controller
 * Handles operations related to assignments and assignment drafts
 */
const Assignment = require("../models/assignmentModel");
const Question = require("../models/questionModel");
const Class = require("../models/classModel");
const Teacher = require("../models/teacherModel");
const Student = require("../models/studentModel");

/**
 * Create a new assignment with questions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createAssignment = async (req, res) => {
  try {
    const {
      title,
      maxMarks,
      questions,
      active,
      classId: requestClassId,
    } = req.body;
    const teacherId = req.user.id;

    console.log("Assignment creation request:", {
      title,
      maxMarks,
      questionsCount: questions?.length || 0,
      active,
      requestClassId,
      teacherId,
    });

    // Input validation
    if (
      !title ||
      !questions ||
      !Array.isArray(questions) ||
      questions.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Title and at least one question are required",
      });
    }

    // Find the teacher
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    // Check if the teacher has any classes
    if (!teacher.classes || teacher.classes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Teacher has no classes to assign to",
      });
    }

    // Use the provided classId if available, otherwise fall back to the first class
    let classId = requestClassId || teacher.classes[0];
    console.log("Using classId:", classId);

    // Validate class and teacher relationship
    const classData = await Class.findById(classId);
    if (!classData) {
      console.error("Class not found with ID:", classId);
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Validate that the class belongs to this teacher
    if (!teacher.classes.includes(classId)) {
      console.error("Class not associated with teacher:", {
        classId,
        teacherClasses: teacher.classes,
      });
      return res.status(403).json({
        success: false,
        message: "You don't have permission to add assignments to this class",
      });
    }

    // 1. Create question documents
    const questionDocs = questions.map((q) => ({
      text: q.text,
      maxMarks: q.maxMarks || 0,
      rubric: q.rubric || "",
    }));

    const createdQuestions = await Question.insertMany(questionDocs);
    const questionIds = createdQuestions.map((q) => q._id);

    // 2. Create the assignment
    const newAssignment = await Assignment.create({
      title,
      questions: questionIds,
      active: active !== undefined ? active : true,
    });

    // 3. Add the assignment to the class
    classData.assignments.push(newAssignment._id);
    await classData.save();

    // 4. Find all students in this class and assign the assignment to them
    const students = await Student.find({ classes: classId });
    console.log(
      `Found ${students.length} students to assign the assignment to`
    );

    // Create empty responses for each question
    const emptyResponses = questionIds.map((questionId) => ({
      question: questionId,
      solution: "",
    }));

    // Update each student to add this assignment with "pending" status
    for (const student of students) {
      // Check if student already has this assignment (shouldn't happen for new assignments)
      const hasAssignment = student.assignments.some(
        (a) => a.assignment.toString() === newAssignment._id.toString()
      );

      if (!hasAssignment) {
        // Add the assignment to the student's assignments array
        student.assignments.push({
          assignment: newAssignment._id,
          status: "pending",
          responses: emptyResponses,
        });

        await student.save();
      }
    }

    console.log("Assignment created successfully:", {
      assignmentId: newAssignment._id,
      title: newAssignment.title,
      questionsCount: questionIds.length,
      classId: classData._id,
      studentsAssigned: students.length,
    });

    res.status(201).json({
      success: true,
      message: "Assignment created successfully",
      data: {
        id: newAssignment._id,
        title: newAssignment.title,
        active: newAssignment.active,
        questionCount: questionIds.length,
        classId: classData._id,
        studentsAssigned: students.length,
      },
    });
  } catch (err) {
    console.error("Error creating assignment:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

/**
 * Update an existing assignment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { title, questions, active } = req.body;
    const teacherId = req.user.id;

    console.log("Assignment update request:", {
      assignmentId,
      title,
      questionsCount: questions?.length || 0,
      active,
    });

    // Input validation
    if (
      !assignmentId ||
      !title ||
      !questions ||
      !Array.isArray(questions) ||
      questions.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Assignment ID, title, and at least one question are required",
      });
    }

    // Find the assignment to update
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    // Find the class that contains this assignment
    const classData = await Class.findOne({ assignments: assignmentId });
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found for this assignment",
      });
    }

    // Verify this teacher owns this class
    const teacher = await Teacher.findById(teacherId);
    if (!teacher || !teacher.classes.includes(classData._id.toString())) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to edit this assignment",
      });
    }

    // Get existing question IDs to delete
    const existingQuestionIds = assignment.questions;

    // Create new question documents
    const questionDocs = questions.map((q) => ({
      text: q.text,
      maxMarks: q.maxMarks || 0,
      rubric: q.rubric || "",
    }));

    const newQuestions = await Question.insertMany(questionDocs);
    const newQuestionIds = newQuestions.map((q) => q._id);

    // Update the assignment with new information
    assignment.title = title;
    assignment.questions = newQuestionIds;
    if (active !== undefined) {
      assignment.active = active;
    }

    await assignment.save();

    // Find all students who have this assignment and update their responses
    const studentsWithAssignment = await Student.find({
      "assignments.assignment": assignmentId,
    });
    console.log(
      `Found ${studentsWithAssignment.length} students with this assignment`
    );

    // Create empty responses for the new questions
    const emptyResponses = newQuestionIds.map((questionId) => ({
      question: questionId,
      solution: "",
    }));

    // Update each student's assignment
    for (const student of studentsWithAssignment) {
      // Find the assignment in the student's assignments array
      const assignmentIndex = student.assignments.findIndex(
        (a) => a.assignment.toString() === assignmentId
      );

      if (assignmentIndex !== -1) {
        // Update with new questions while preserving the assignment status
        const currentStatus = student.assignments[assignmentIndex].status;
        const submissionDate =
          student.assignments[assignmentIndex].submissionDate;

        // Replace the responses with new empty ones
        student.assignments[assignmentIndex].responses = emptyResponses;

        await student.save();
        console.log(`Updated assignment for student: ${student.full_name}`);
      }
    }

    // Delete the old questions to prevent orphaned data
    if (existingQuestionIds && existingQuestionIds.length > 0) {
      await Question.deleteMany({ _id: { $in: existingQuestionIds } });
    }

    console.log("Assignment updated successfully:", {
      assignmentId: assignment._id,
      title: assignment.title,
      questionsCount: newQuestionIds.length,
      studentsUpdated: studentsWithAssignment.length,
    });

    res.status(200).json({
      success: true,
      message: "Assignment updated successfully",
      data: {
        id: assignment._id,
        title: assignment.title,
        active: assignment.active,
        questionCount: newQuestionIds.length,
        studentsUpdated: studentsWithAssignment.length,
      },
    });
  } catch (err) {
    console.error("Error updating assignment:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

/**
 * Save an assignment draft for a teacher
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.saveDraft = async (req, res) => {
  try {
    const { title, maxMarks, questions, classId } = req.body;
    const teacherId = req.user.id;

    console.log("Draft save request received:", {
      teacherId,
      title,
      maxMarks,
      questionsCount: questions?.length || 0,
      classId,
    });

    if (!title || !questions || !Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        message: "Title and questions are required",
      });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      console.log("Teacher not found with ID:", teacherId);
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    // Create the draft object
    const draft = {
      title,
      maxMarks: maxMarks || 0,
      questions: questions.map((q, index) => ({
        text: q.text,
        points: q.points || 0,
        rubric: q.rubric || "",
      })),
      lastUpdated: new Date(),
      classId: classId || null,
    };

    // Check if a draft with the same title exists
    const existingDraftIndex = teacher.drafts.findIndex(
      (d) => d.title === title
    );

    if (existingDraftIndex !== -1) {
      // Update existing draft
      teacher.drafts[existingDraftIndex] = draft;
    } else {
      // Add new draft
      teacher.drafts.push(draft);
    }

    try {
      await teacher.save();
      res.status(200).json({
        success: true,
        message: "Draft saved successfully",
        draft,
      });
    } catch (saveError) {
      console.error("Error saving teacher document:", saveError);
      return res.status(500).json({
        success: false,
        message: "Error saving draft: " + saveError.message,
        error: saveError,
      });
    }
  } catch (err) {
    console.error("Error in draft API:", err);
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
      error: err,
    });
  }
};

/**
 * Get all drafts for a teacher
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAllDrafts = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Drafts retrieved successfully",
      drafts: teacher.drafts,
    });
  } catch (err) {
    console.error("Error retrieving drafts:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * Get a specific draft by ID (index in the drafts array)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDraftById = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { id } = req.params;

    // Convert the ID to a number (array index)
    const draftIndex = parseInt(id, 10);

    if (isNaN(draftIndex) || draftIndex < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid draft ID format",
      });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    // Check if the index is within bounds
    if (!teacher.drafts || draftIndex >= teacher.drafts.length) {
      return res.status(404).json({
        success: false,
        message: "Draft not found",
      });
    }

    // Get the draft at the specified index
    const draft = teacher.drafts[draftIndex];

    res.status(200).json({
      success: true,
      message: "Draft retrieved successfully",
      draft,
    });
  } catch (err) {
    console.error("Error retrieving draft:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * Delete a draft
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteDraft = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { id } = req.params;

    // Convert the ID to a number (array index)
    const draftIndex = parseInt(id, 10);

    if (isNaN(draftIndex) || draftIndex < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid draft ID format",
      });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    // Check if the index is within bounds
    if (!teacher.drafts || draftIndex >= teacher.drafts.length) {
      return res.status(404).json({
        success: false,
        message: "Draft not found",
      });
    }

    // Remove the draft at the specified index
    teacher.drafts.splice(draftIndex, 1);
    await teacher.save();

    res.status(200).json({
      success: true,
      message: "Draft deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting draft:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * Get detailed information about an assignment including student submissions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAssignmentDetails = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    if (!assignmentId) {
      return res.status(400).json({
        success: false,
        message: "Assignment ID is required",
      });
    }

    // Find the assignment
    const assignment = await Assignment.findById(assignmentId).populate(
      "questions",
      "text maxMarks rubric"
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    // Find the class containing this assignment
    const classData = await Class.findOne({ assignments: assignmentId });

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found for this assignment",
      });
    }

    // Calculate max marks from all questions
    const maxMarks = assignment.questions.reduce(
      (total, q) => total + q.maxMarks,
      0
    );

    // Find all students in this class with their assignment submissions
    const students = await Student.find({ classes: classData._id }).select(
      "full_name assignments"
    );

    // Format student results for this assignment
    const studentResults = await Promise.all(
      students.map(async (student) => {
        // Find this specific assignment in student's assignments
        const studentAssignment = student.assignments.find(
          (a) => a.assignment.toString() === assignmentId
        );

        if (!studentAssignment) {
          // Student hasn't been assigned yet
          return {
            studentId: student._id,
            studentName: student.full_name,
            status: "pending",
            isShared: false,
          };
        }

        // Removed grading-specific score calculation; will be rewritten
        return {
          studentId: student._id,
          studentName: student.full_name,
          status: studentAssignment.status,
          submissionDate: studentAssignment.submissionDate,
          isShared: studentAssignment.isShared,
          sharedUrl: studentAssignment.sharedUrl,
        };
      })
    );

    // Log response data for debugging
    console.log("Sending assignment details with classId:", classData._id);

    res.status(200).json({
      success: true,
      data: {
        id: assignment._id,
        title: assignment.title,
        status: assignment.active ? "active" : "completed",
        maxMarks,
        questions: assignment.questions,
        students: studentResults,
        classId: classData._id.toString(), // Ensure classId is a string
        className: classData.title,
      },
    });
  } catch (err) {
    console.error("Error getting assignment details:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

/**
 * Update student assignment status or result
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateStudentAssignment = async (req, res) => {
  res
    .status(501)
    .json({ success: false, message: "updateStudentAssignment removed" });
};

/**
 * Get available students for an assignment (students in the class who aren't assigned yet)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAvailableStudents = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    if (!assignmentId) {
      return res.status(400).json({
        success: false,
        message: "Assignment ID is required",
      });
    }

    // Find the assignment
    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    // Find the class containing this assignment
    const classData = await Class.findOne({ assignments: assignmentId });

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found for this assignment",
      });
    }

    // Get all students for this class who have the assignment with failed or pending status
    const availableStudents = await Student.find({
      classes: classData._id,
      "assignments.assignment": assignmentId,
      "assignments.status": { $in: ["failed", "pending"] },
    }).select("_id full_name mobileNo rollNo");

    console.log(
      `Found ${availableStudents.length} students with failed or pending status for assignment ${assignmentId}`
    );

    // Return students with failed or pending status
    res.status(200).json({
      success: true,
      message:
        "Available students with failed or pending status fetched successfully",
      data: availableStudents,
    });
  } catch (err) {
    console.error("Error getting available students:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};
/**
 * Get the rubric for a specific question in an assignment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getQuestionRubric = async (req, res) => {
  const { assignmentId, questionId } = req.params;
  if (!assignmentId || !questionId) {
    return res.status(400).json({
      success: false,
      message: "Assignment ID and question ID are required",
    });
  }
  try {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }
    // Ensure question is part of this assignment
    if (!assignment.questions.map(String).includes(questionId)) {
      return res.status(404).json({
        success: false,
        message: "Question not found in this assignment",
      });
    }
    const question = await Question.findById(questionId).select("rubric");
    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }
    return res
      .status(200)
      .json({ success: true, data: { rubric: question.rubric } });
  } catch (err) {
    console.error("Error getting question rubric:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

/**
 * Save steps breakdown for a specific student's question response
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.saveQuestionStepsBreakdown = async (req, res) => {
  res
    .status(501)
    .json({ success: false, message: "saveQuestionStepsBreakdown removed" });
};
