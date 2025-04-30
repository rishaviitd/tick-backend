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

    // Validate class and teacher relationship
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Validate that the class belongs to this teacher
    if (!teacher.classes.includes(classId)) {
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
 * Save an assignment draft for a teacher
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.saveDraft = async (req, res) => {
  try {
    const { title, maxMarks, questions } = req.body;
    const teacherId = req.user.id;

    console.log("Draft save request received:", {
      teacherId,
      title,
      maxMarks,
      questionsCount: questions?.length || 0,
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
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.status(200).json({
      message: "Drafts retrieved successfully",
      drafts: teacher.drafts,
    });
  } catch (err) {
    console.error("Error retrieving drafts:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get a specific draft by title
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDraftByTitle = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { title } = req.params;

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const draft = teacher.drafts.find((d) => d.title === title);
    if (!draft) {
      return res.status(404).json({ message: "Draft not found" });
    }

    res.status(200).json({
      message: "Draft retrieved successfully",
      draft,
    });
  } catch (err) {
    console.error("Error retrieving draft:", err);
    res.status(500).json({ message: "Server error" });
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
    const { title } = req.params;

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const draftIndex = teacher.drafts.findIndex((d) => d.title === title);
    if (draftIndex === -1) {
      return res.status(404).json({ message: "Draft not found" });
    }

    // Remove the draft
    teacher.drafts.splice(draftIndex, 1);
    await teacher.save();

    res.status(200).json({
      message: "Draft deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting draft:", err);
    res.status(500).json({ message: "Server error" });
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
        solution: "pending", // Provide a non-empty default value to pass validation
        feedback: { marks: 0, comment: "" },
      }));

      // Add the new assignment to student
      student.assignments.push({
        assignment: assignmentId,
        status,
        isShared: isShared || false,
        totalScore: totalScore || 0,
        responses,
      });
    } else {
      // Update existing assignment
      if (status) {
        student.assignments[assignmentIndex].status = status;
      }

      if (isShared !== undefined) {
        student.assignments[assignmentIndex].isShared = isShared;

        // Generate shared URL if being shared
        if (isShared) {
          const sharedUrl = `${
            process.env.FRONTEND_URL || "https://example.com"
          }/results/${studentId}/${assignmentId}`;
          student.assignments[assignmentIndex].sharedUrl = sharedUrl;
        }
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
            if (item.marks !== undefined) {
              student.assignments[assignmentIndex].responses[
                responseIndex
              ].feedback.marks = item.marks;
            }

            if (item.comment !== undefined) {
              student.assignments[assignmentIndex].responses[
                responseIndex
              ].feedback.comment = item.comment;
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
