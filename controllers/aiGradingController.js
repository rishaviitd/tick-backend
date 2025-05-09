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
      (a) => a.assignment && a.assignment.toString() === assignmentId
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
    const { feedbackData, solutions, status } = req.body;

    console.log("updateGrades called with:", {
      assignmentId,
      studentId,
      status,
      feedbackData: feedbackData?.length || 0,
      solutions: solutions?.length || 0,
      body: JSON.stringify(req.body).substring(0, 100) + "...", // Log partial body for debugging
    });

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
      (a) => a.assignment && a.assignment.toString() === assignmentId
    );

    if (assignmentIndex === -1) {
      console.error("Assignment not found for student:", {
        studentId,
        assignmentId,
        assignmentsCount: student.assignments.length,
        assignments: student.assignments.map((a) => ({
          id: a.assignment?.toString(),
          status: a.status,
        })),
      });
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
      console.log(`Updating status to: ${status}`);
      student.assignments[assignmentIndex].status = status;
    } else {
      // Default to completed
      console.log("No status provided, defaulting to completed");
      student.assignments[assignmentIndex].status = "completed";
    }

    // Use either feedbackData or solutions, whichever is provided
    const solutionsData = feedbackData || solutions || [];

    // If feedback for individual questions is provided
    if (solutionsData && Array.isArray(solutionsData)) {
      console.log(`Processing ${solutionsData.length} solution items`);

      solutionsData.forEach((feedback) => {
        if (!feedback.questionId) {
          console.warn("Skipping feedback item without questionId");
          return;
        }

        console.log(`Processing solution for question ${feedback.questionId}`);

        const responseIndex = student.assignments[
          assignmentIndex
        ].responses.findIndex(
          (r) => r.question && r.question.toString() === feedback.questionId
        );

        if (responseIndex !== -1) {
          // Update the solution
          student.assignments[assignmentIndex].responses[
            responseIndex
          ].solution = feedback.solution || "";
          console.log(`Updated solution for question ${feedback.questionId}`);
        } else {
          console.warn(
            `Question ${feedback.questionId} not found in student responses. Available questions:`,
            student.assignments[assignmentIndex].responses.map((r) => ({
              id: r.question?.toString(),
              hasSolution: !!r.solution,
            }))
          );
        }
      });
    }

    // Log the updated student assignment for debugging
    console.log("Updated student assignment:", {
      status: student.assignments[assignmentIndex].status,
      responsesCount: student.assignments[assignmentIndex].responses.length,
      firstSolution:
        student.assignments[assignmentIndex].responses[0]?.solution?.substring(
          0,
          50
        ) || "none",
    });

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

/**
 * Debug function to directly update solutions for testing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.debugUpdateSolution = async (req, res) => {
  try {
    const { assignmentId, studentId } = req.params;
    const { questionIndex, solution } = req.body;

    console.log("Debug update solution called with:", {
      assignmentId,
      studentId,
      questionIndex,
      solutionLength: solution?.length || 0,
    });

    if (
      !assignmentId ||
      !studentId ||
      questionIndex === undefined ||
      !solution
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Assignment ID, student ID, questionIndex, and solution are required",
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
      (a) => a.assignment && a.assignment.toString() === assignmentId
    );

    if (assignmentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found for this student",
      });
    }

    // Get the responses array
    const responses = student.assignments[assignmentIndex].responses;

    // Check if the questionIndex is valid
    if (questionIndex < 0 || questionIndex >= responses.length) {
      return res.status(400).json({
        success: false,
        message: `Invalid questionIndex. Must be between 0 and ${
          responses.length - 1
        }`,
        availableQuestions: responses.map((r, i) => ({
          index: i,
          id: r.question?.toString(),
        })),
      });
    }

    // Update the solution
    student.assignments[assignmentIndex].responses[questionIndex].solution =
      solution;

    // Also update the status to "graded"
    student.assignments[assignmentIndex].status = "graded";

    await student.save();

    res.status(200).json({
      success: true,
      message: "Solution updated successfully for debugging",
      data: {
        studentId,
        assignmentId,
        questionIndex,
        solution:
          solution.substring(0, 50) + (solution.length > 50 ? "..." : ""),
        status: "graded",
      },
    });
  } catch (err) {
    console.error("Error in debug update solution:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

/**
 * Get steps breakdown for a student's question response
 */
exports.getQuestionStepsBreakdown = async (req, res) => {
  try {
    const { assignmentId, studentId, questionId } = req.params;
    if (!assignmentId || !studentId || !questionId) {
      return res.status(400).json({
        success: false,
        message: "assignmentId, studentId, and questionId are required",
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    const assignmentEntry = student.assignments.find(
      (a) => a.assignment?.toString() === assignmentId
    );
    if (!assignmentEntry) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found for this student",
      });
    }

    const responseEntry = assignmentEntry.responses.find(
      (r) => r.question?.toString() === questionId
    );
    if (!responseEntry || !responseEntry.stepsBreakdown) {
      return res
        .status(404)
        .json({ success: false, message: "Steps breakdown not found" });
    }

    // Get the question's maxMarks
    const question = await Question.findById(questionId);
    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    // Add maxMarks to the response
    const response = {
      ...responseEntry.stepsBreakdown.toObject(),
      maxMarks: question.maxMarks,
    };

    return res.status(200).json({ success: true, data: response });
  } catch (err) {
    console.error("Error retrieving steps breakdown:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

/**
 * Update evaluated steps and overall assessment for a student's question response
 */
exports.evaluatedSteps = async (req, res) => {
  try {
    const { assignmentId, studentId, questionId } = req.params;
    const { overallAssessment, evaluatedSteps } = req.body;

    if (
      !assignmentId ||
      !studentId ||
      !questionId ||
      !overallAssessment ||
      typeof overallAssessment.summary === "undefined" ||
      typeof overallAssessment.score === "undefined" ||
      !Array.isArray(evaluatedSteps)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "assignmentId, studentId, questionId, overallAssessment (with summary and score), and evaluatedSteps are required",
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    const assignmentIndex = student.assignments.findIndex(
      (a) => a.assignment?.toString() === assignmentId
    );
    if (assignmentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found for this student",
      });
    }

    const responses = student.assignments[assignmentIndex].responses;
    const responseIndex = responses.findIndex(
      (r) => r.question?.toString() === questionId
    );
    if (responseIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Question not found in student's responses",
      });
    }

    const responseEntry = responses[responseIndex];

    // Update overall assessment with both summary and score
    responseEntry.stepsBreakdown.overallAssessment = {
      summary: overallAssessment.summary,
      score: overallAssessment.score,
    };

    // Update each evaluated step
    evaluatedSteps.forEach((evalStep) => {
      if (evalStep.stepNumber === undefined) return;
      const step = responseEntry.stepsBreakdown.steps.find(
        (s) => s.stepNumber === evalStep.stepNumber
      );
      if (step) {
        if (evalStep.status) step.status = evalStep.status;
        if (evalStep.justification) step.justification = evalStep.justification;
      }
    });

    await student.save();

    res.status(200).json({
      success: true,
      message: "Evaluated steps updated successfully",
      data: responseEntry.stepsBreakdown,
    });
  } catch (err) {
    console.error("Error updating evaluated steps:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};
