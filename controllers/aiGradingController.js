/**
 * AI Grading Controller
 * Handles operations related to automatic grading using AI
 */
const Student = require("../models/studentModel");
const Assignment = require("../models/assignmentModel");
const Question = require("../models/questionModel");

/**
 * Start AI grading process for a student submission
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
        feedback: { marks: 0, comment: "" },
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

    // In a real implementation, we would initiate a background job for AI grading here
    // For now, we'll just return success to indicate the grading process has started

    res.status(200).json({
      success: true,
      message: "Grading process started",
      data: {
        studentId,
        assignmentId,
        status: "processing",
      },
    });
  } catch (err) {
    console.error("Error starting grading process:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

/**
 * Update the grades from AI processing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateGrades = async (req, res) => {
  try {
    const { assignmentId, studentId } = req.params;
    const { totalScore, feedbackData, aiFeedback } = req.body;

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

    // Update the assignment with grades and feedback
    student.assignments[assignmentIndex].status = "graded";
    student.assignments[assignmentIndex].totalScore = totalScore;

    // Save detailed AI feedback if provided
    if (aiFeedback) {
      student.assignments[assignmentIndex].aiFeedback = aiFeedback;
    }

    // If feedback for individual questions is provided, update feedback and solution
    if (feedbackData && Array.isArray(feedbackData)) {
      feedbackData.forEach((feedback) => {
        const responseIndex = student.assignments[
          assignmentIndex
        ].responses.findIndex(
          (r) => r.question.toString() === feedback.questionId
        );

        if (responseIndex !== -1) {
          // Update marks and comment
          student.assignments[assignmentIndex].responses[
            responseIndex
          ].feedback = {
            marks: feedback.marks || 0,
            comment: feedback.comment || "",
          };
          // Update extracted solution if provided
          if (feedback.solution !== undefined) {
            student.assignments[assignmentIndex].responses[
              responseIndex
            ].solution = feedback.solution;
          }
        }
      });
    }

    await student.save();

    res.status(200).json({
      success: true,
      message: "Grades updated successfully",
      data: {
        studentId,
        assignmentId,
        totalScore,
        status: "graded",
      },
    });
  } catch (err) {
    console.error("Error updating grades:", err);
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

    // TODO: Process the uploaded file, store it, and start AI grading

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
        totalScore: studentAssignment.totalScore,
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
 * Get detailed feedback for a student's assignment
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

    // Find the student with populated assignment and questions
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

    // Format the detailed feedback response
    const detailedFeedback = {
      assignmentId,
      studentId,
      studentName: student.full_name,
      assignmentTitle: assignment.title,
      status: studentAssignment.status,
      totalScore: studentAssignment.totalScore,
      submissionDate: studentAssignment.submissionDate,
      aiFeedback: studentAssignment.aiFeedback || null,
      questionResponses: await Promise.all(
        studentAssignment.responses.map(async (response) => {
          const question = await Question.findById(response.question);
          return {
            questionId: response.question,
            questionText: question ? question.text : "Question not found",
            solution: response.solution,
            feedback: response.feedback,
          };
        })
      ),
    };

    res.status(200).json({
      success: true,
      data: detailedFeedback,
    });
  } catch (err) {
    console.error("Error getting detailed feedback:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};
