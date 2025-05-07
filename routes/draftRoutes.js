/**
 * Draft Routes
 * Routes for managing teacher assignment drafts
 */
const express = require("express");
const draftController = require("../controllers/draftController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Protect all draft routes with authentication
router.use(authMiddleware);

// Get all drafts for a teacher
router.get("/", draftController.getDrafts);

// Create or update a draft
router.post("/", draftController.createOrUpdateDraft);

// Delete a draft
router.delete("/:title", draftController.deleteDraft);

module.exports = router;
