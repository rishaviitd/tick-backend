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

    console.log("Assignment created successfully:", {
      assignmentId: newAssignment._id,
      title: newAssignment.title,
      questionsCount: questionIds.length,
      classId: classData._id,
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

    // Delete the old questions to prevent orphaned data
    if (existingQuestionIds && existingQuestionIds.length > 0) {
      await Question.deleteMany({ _id: { $in: existingQuestionIds } });
    }

    console.log("Assignment updated successfully:", {
      assignmentId: assignment._id,
      title: assignment.title,
      questionsCount: newQuestionIds.length,
    });

    res.status(200).json({
      success: true,
      message: "Assignment updated successfully",
      data: {
        id: assignment._id,
        title: assignment.title,
        active: assignment.active,
        questionCount: newQuestionIds.length,
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
    const students = await Student.find({ class: classData._id }).select(
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

        // Calculate total score from responses if graded
        let score = studentAssignment.totalScore;
        if (studentAssignment.status === "graded" && !score) {
          score = studentAssignment.responses.reduce(
            (total, r) => total + (r.feedback?.marks || 0),
            0
          );
        }

        return {
          studentId: student._id,
          studentName: student.full_name,
          status: studentAssignment.status,
          score: studentAssignment.status === "graded" ? score : undefined,
          submissionDate: studentAssignment.submissionDate,
          isShared: studentAssignment.isShared,
          sharedUrl: studentAssignment.sharedUrl,
        };
      })
    );

    // Calculate completion percentage
    const gradedCount = studentResults.filter(
      (s) => s.status === "graded"
    ).length;
    const totalStudents = studentResults.length;
    const completion =
      totalStudents > 0 ? Math.round((gradedCount / totalStudents) * 100) : 0;

    // Log response data for debugging
    console.log("Sending assignment details with classId:", classData._id);

    res.status(200).json({
      success: true,
      data: {
        id: assignment._id,
        title: assignment.title,
        status: assignment.active ? "active" : "completed",
        maxMarks,
        completion,
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
  try {
    const { assignmentId, studentId } = req.params;
    const { status, isShared, totalScore, feedback } = req.body;

    if (!assignmentId || !studentId) {
      return res.status(400).json({
        success: false,
        message: "Assignment ID and Student ID are required",
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Find the assignment in the student's assignments array
    const assignmentIndex = student.assignments.findIndex(
      (a) => a.assignment.toString() === assignmentId
    );

    if (assignmentIndex === -1) {
      // If assignment doesn't exist for student yet, create it
      if (!status) {
        return res.status(400).json({
          success: false,
          message: "Status is required for new assignment",
        });
      }

      // Validate status is one of the allowed values
      const validStatuses = [
        "pending",
        "submitted",
        "processing",
        "completed",
        "graded",
        "failed",
      ];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status value. Must be one of: ${validStatuses.join(
            ", "
          )}`,
        });
      }

      // Find the assignment to get its questions
      const assignment = await Assignment.findById(assignmentId).populate(
        "questions"
      );

      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: "Assignment not found",
        });
      }

      // Create empty responses for each question
      const responses = assignment.questions.map((q) => ({
        question: q._id,
        solution: "",
      }));

      // Add the new assignment to student
      student.assignments.push({
        assignment: assignmentId,
        status,
        responses,
      });
    } else {
      // Update existing assignment
      if (status) {
        // Validate status is one of the allowed values
        const validStatuses = [
          "pending",
          "submitted",
          "processing",
          "completed",
          "graded",
          "failed",
        ];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({
            success: false,
            message: `Invalid status value. Must be one of: ${validStatuses.join(
              ", "
            )}`,
          });
        }
        student.assignments[assignmentIndex].status = status;
      }

      if (isShared !== undefined) {
        student.assignments[assignmentIndex].isShared = isShared;
      }

      if (totalScore !== undefined) {
        student.assignments[assignmentIndex].totalScore = totalScore;
      }

      // If feedback provided, update individual question feedback
      if (feedback && Array.isArray(feedback)) {
        feedback.forEach((item) => {
          if (!item.questionId) return;

          const responseIndex = student.assignments[
            assignmentIndex
          ].responses.findIndex(
            (r) => r.question.toString() === item.questionId
          );

          if (responseIndex !== -1) {
            // Update the solution if provided
            if (item.solution !== undefined) {
              student.assignments[assignmentIndex].responses[
                responseIndex
              ].solution = item.solution || "";
            }
          }
        });
      }
    }

    await student.save();

    res.status(200).json({
      success: true,
      message: "Student assignment updated successfully",
    });
  } catch (err) {
    console.error("Error updating student assignment:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

/**
 * Retry grading for a student's failed assignment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.retryGrading = async (req, res) => {
  try {
    const { assignmentId, studentId } = req.params;

    if (!assignmentId || !studentId) {
      return res.status(400).json({
        success: false,
        message: "Assignment ID and Student ID are required",
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Find the assignment in the student's assignments array
    const assignmentIndex = student.assignments.findIndex(
      (a) => a.assignment.toString() === assignmentId
    );

    if (assignmentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found for this student",
      });
    }

    // Update the status to "processing" to indicate regrading
    student.assignments[assignmentIndex].status = "processing";
    await student.save();

    // Here you would typically initiate a background job for actual grading
    // For now, we'll just return success

    res.status(200).json({
      success: true,
      message: "Grading retried successfully",
    });
  } catch (err) {
    console.error("Error retrying grading:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
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

    // Get all students for this class
    const allClassStudents = await Student.find({
      class: classData._id,
    }).select("_id full_name mobileNo rollNo");

    // Get students who already have this assignment
    const studentsWithAssignment = await Student.find({
      "assignments.assignment": assignmentId,
    }).select("_id");

    const assignedStudentIds = studentsWithAssignment.map((s) =>
      s._id.toString()
    );

    // Filter to get only unassigned students
    const availableStudents = allClassStudents.filter(
      (student) => !assignedStudentIds.includes(student._id.toString())
    );

    console.log(
      `Found ${availableStudents.length} available students out of ${allClassStudents.length} total`
    );

    res.status(200).json({
      success: true,
      message: "Available students fetched successfully",
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
