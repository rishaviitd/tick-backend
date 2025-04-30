/**
 * Draft Controller
 * Handles operations for teacher assignment drafts
 */
const Teacher = require("../models/teacherModel");

/**
 * Get all drafts for a teacher
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDrafts = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        error: "Teacher not found",
      });
    }

    return res.status(200).json({
      success: true,
      drafts: teacher.drafts || [],
    });
  } catch (error) {
    console.error("Error fetching drafts:", error);
    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};

/**
 * Get a specific draft by title
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDraft = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const draftTitle = req.params.title;

    if (!draftTitle) {
      return res.status(400).json({
        success: false,
        error: "Draft title is required",
      });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        error: "Teacher not found",
      });
    }

    const draft = teacher.drafts.find((draft) => draft.title === draftTitle);
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: "Draft not found",
      });
    }

    return res.status(200).json({
      success: true,
      draft,
    });
  } catch (error) {
    console.error("Error fetching draft:", error);
    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};

/**
 * Create or update a draft
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createOrUpdateDraft = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { title, maxMarks, questions } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: "Draft title is required",
      });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        error: "Teacher not found",
      });
    }

    // Check if draft with this title already exists (update if it does)
    const draftIndex = teacher.drafts.findIndex(
      (draft) => draft.title === title
    );

    const newDraft = {
      title,
      maxMarks: maxMarks || 0,
      questions: questions.map((q) => ({
        text: q.text,
        points: q.points || 0,
        rubric: q.rubric || "",
      })),
      lastUpdated: new Date(),
    };

    if (draftIndex !== -1) {
      // Update existing draft
      teacher.drafts[draftIndex] = newDraft;
    } else {
      // Create new draft
      teacher.drafts.push(newDraft);
    }

    await teacher.save();

    return res.status(200).json({
      success: true,
      message: "Draft saved successfully",
      draft: newDraft,
    });
  } catch (error) {
    console.error("Error saving draft:", error);
    return res.status(500).json({
      success: false,
      error: "Server error",
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
    const draftTitle = req.params.title;

    if (!draftTitle) {
      return res.status(400).json({
        success: false,
        error: "Draft title is required",
      });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        error: "Teacher not found",
      });
    }

    const initialDraftsCount = teacher.drafts.length;
    teacher.drafts = teacher.drafts.filter(
      (draft) => draft.title !== draftTitle
    );

    if (teacher.drafts.length === initialDraftsCount) {
      return res.status(404).json({
        success: false,
        error: "Draft not found",
      });
    }

    await teacher.save();

    return res.status(200).json({
      success: true,
      message: "Draft deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting draft:", error);
    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};
