/**
 * AI Grading Controller
 * Handles operations related to extracting student solutions
 */
const Student = require("../models/studentModel");
const Assignment = require("../models/assignmentModel");
const Question = require("../models/questionModel");

/**
 * Start solution extraction process for a student submission
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.startGrading = async (req, res) => {
  try {
    const { assignmentId, studentId } = req.params;
    const { submissionData } = req.body;

    if (!assignmentId || !studentId || !submissionData) {
      return res.status(400).json({
        success: false,
        message: "Assignment ID, student ID, and submission data are required",
      });
    }

    // Find the assignment
    const assignment = await Assignment.findById(assignmentId).populate(
      "questions"
    );
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    // Find the student
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
      // If the student doesn't have this assignment yet, create it
      const responses = assignment.questions.map((q) => ({
        question: q._id,
        solution: "",
      }));

      student.assignments.push({
        assignment: assignmentId,
        status: "processing",
        submissionDate: new Date(),
        responses,
      });
    } else {
      // Update the existing assignment
      student.assignments[assignmentIndex].status = "processing";
      student.assignments[assignmentIndex].submissionDate = new Date();
    }

    await student.save();

    res.status(200).json({
      success: true,
      message: "Solution extraction process started",
      data: {
        studentId,
        assignmentId,
        status: "processing",
      },
    });
  } catch (err) {
    console.error("Error starting solution extraction process:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

/**
 * Update the solutions from AI processing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateGrades = async (req, res) => {
  try {
    const { assignmentId, studentId } = req.params;
    const { feedbackData, status } = req.body;

    if (!assignmentId || !studentId) {
      return res.status(400).json({
        success: false,
        message: "Assignment ID and student ID are required",
      });
    }

    // Find the student
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

    // Update the assignment status if provided
    if (status) {
      // Validate the status value
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
    } else {
      // Default to completed
      student.assignments[assignmentIndex].status = "completed";
    }

    // If feedback for individual questions is provided
    if (feedbackData && Array.isArray(feedbackData)) {
      console.log(`Processing ${feedbackData.length} feedback items`);

      feedbackData.forEach((feedback) => {
        if (!feedback.questionId) {
          console.warn("Skipping feedback item without questionId");
          return;
        }

        console.log(`Processing feedback for question ${feedback.questionId}`);

        const responseIndex = student.assignments[
          assignmentIndex
        ].responses.findIndex(
          (r) => r.question.toString() === feedback.questionId
        );

        if (responseIndex !== -1) {
          // Update the solution
          student.assignments[assignmentIndex].responses[
            responseIndex
          ].solution = feedback.solution || "";
          console.log(`Updated solution for question ${feedback.questionId}`);
        } else {
          console.warn(
            `Question ${feedback.questionId} not found in student responses`
          );
        }
      });
    }

    await student.save();
    console.log("Student document saved successfully");

    res.status(200).json({
      success: true,
      message: "Solutions updated successfully",
      data: {
        studentId,
        assignmentId,
        status: student.assignments[assignmentIndex].status,
      },
    });
  } catch (err) {
    console.error("Error updating solutions:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

/**
 * Upload and process a submission file
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.uploadSubmission = async (req, res) => {
  try {
    const { assignmentId, studentId } = req.params;
    const submissionFile = req.file;

    if (!assignmentId || !studentId || !submissionFile) {
      return res.status(400).json({
        success: false,
        message: "Assignment ID, student ID, and submission file are required",
      });
    }

    // TODO: Process the uploaded file, store it, and start solution extraction

    // For now, we'll just return success
    res.status(200).json({
      success: true,
      message: "Submission uploaded successfully",
      data: {
        studentId,
        assignmentId,
        fileName: submissionFile.filename,
        status: "processing",
      },
    });
  } catch (err) {
    console.error("Error uploading submission:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

/**
 * Get submission status for an assignment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getSubmissionStatus = async (req, res) => {
  try {
    const { assignmentId, studentId } = req.params;

    if (!assignmentId || !studentId) {
      return res.status(400).json({
        success: false,
        message: "Assignment ID and student ID are required",
      });
    }

    // Find the student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Find the assignment in the student's assignments array
    const studentAssignment = student.assignments.find(
      (a) => a.assignment.toString() === assignmentId
    );

    if (!studentAssignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found for this student",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        studentId,
        assignmentId,
        status: studentAssignment.status,
        submissionDate: studentAssignment.submissionDate,
      },
    });
  } catch (err) {
    console.error("Error getting submission status:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

/**
 * Get detailed solutions for a student's assignment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDetailedFeedback = async (req, res) => {
  try {
    const { assignmentId, studentId } = req.params;

    if (!assignmentId || !studentId) {
      return res.status(400).json({
        success: false,
        message: "Assignment ID and student ID are required",
      });
    }

    // Find the student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Find the assignment in the student's assignments array
    const studentAssignment = student.assignments.find(
      (a) => a.assignment.toString() === assignmentId
    );

    if (!studentAssignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found for this student",
      });
    }

    // Get the assignment with questions
    const assignment = await Assignment.findById(assignmentId).populate(
      "questions"
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    // Format the response with only questions and solutions
    const detailedSolutions = {
      assignmentId,
      studentId,
      studentName: student.full_name,
      assignmentTitle: assignment.title,
      status: studentAssignment.status,
      submissionDate: studentAssignment.submissionDate,
      questionResponses: await Promise.all(
        studentAssignment.responses.map(async (response) => {
          const question = await Question.findById(response.question);
          return {
            questionId: response.question,
            questionText: question ? question.text : "Question not found",
            solution: response.solution,
          };
        })
      ),
    };

    res.status(200).json({
      success: true,
      data: detailedSolutions,
    });
  } catch (err) {
    console.error("Error getting detailed solutions:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};
