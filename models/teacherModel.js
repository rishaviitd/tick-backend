const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Define a separate schema for draft questions
const draftQuestionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, "Question text is required"],
    },
    points: {
      type: Number,
      default: 0,
    },
    rubric: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

// Define a separate schema for drafts
const draftSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Draft title is required"],
    },
    maxMarks: {
      type: Number,
      default: 0,
    },
    questions: [draftQuestionSchema],
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const teacherSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Teacher must have a name"],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      // Make password completely optional
      required: false,
    },
    googleId: {
      type: String,
      sparse: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,

    classes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class",
      },
    ],
    drafts: [draftSchema],
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to log teacher data before saving
teacherSchema.pre("save", function (next) {
  console.log("Saving teacher:", {
    id: this._id,
    name: this.name,
    email: this.email,
    draftsCount: this.drafts?.length || 0,
  });
  next();
});

module.exports = mongoose.model("Teacher", teacherSchema);
