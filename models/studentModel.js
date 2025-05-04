const mongoose = require("mongoose");

const studentAssignmentSchema = new mongoose.Schema({
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Assignment",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "submitted", "processing", "graded", "failed"],
    default: "pending",
  },
  submissionDate: {
    type: Date,
  },
  isShared: {
    type: Boolean,
    default: false,
  },
  sharedUrl: {
    type: String,
  },
  totalScore: {
    type: Number,
    default: 0,
  },
  aiFeedback: {
    overallAssessment: {
      summary: String,
      score: String,
      correctness: String,
    },
    stepAnalysis: [
      {
        stepNumber: Number,
        status: String,
        justification: String,
        skillPoints: [String],
      },
    ],
    transitionAnalysis: {
      quality: String,
      comments: String,
    },
    improvements: [String],
    teacherFeedbackAnalysis: String,
  },
  responses: [
    {
      question: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
        required: true,
      },
      solution: {
        type: String,
        required: true,
      },
      feedback: {
        marks: {
          type: Number,
          default: 0,
        },
        comment: {
          type: String,
          default: "",
        },
      },
    },
  ],
});

const studentSchema = new mongoose.Schema({
  full_name: {
    type: String,
    required: [true, "Student must have a first name"],
  },
  mobileNo: {
    type: String,
    unique: true,
  },
  rollNo: {
    type: String,
    default: "",
    // Explicitly NOT unique
    index: false, // Ensure no separate index is created for this field
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  },

  assignments: {
    type: [studentAssignmentSchema],
    default: [],
  },
});

// Create a compound index for rollNo and class to ensure uniqueness only within a class
studentSchema.index(
  { rollNo: 1, class: 1 },
  {
    unique: true,
    // Skip the constraint check if rollNo is empty
    partialFilterExpression: { rollNo: { $ne: "" } },
  }
);

// Create the model
const Student = mongoose.model("Student", studentSchema);

// This code will attempt to drop any existing index on just the rollNo field
// It needs to be executed after your server is up and running
const dropSingleRollNoIndex = async () => {
  try {
    // Get collection info to find the index name
    const collection = Student.collection;
    const indexInfo = await collection.indexInformation();

    // Look for indexes that only have rollNo
    for (const [indexName, indexFields] of Object.entries(indexInfo)) {
      if (
        indexFields.length === 1 &&
        indexFields[0][0] === "rollNo" &&
        indexName !== "_id_"
      ) {
        console.log(`Dropping single rollNo index: ${indexName}`);
        await collection.dropIndex(indexName);
      }
    }
    console.log("Finished checking for rollNo indexes");
  } catch (error) {
    console.error("Error dropping rollNo index:", error);
  }
};

// Export both the model and the function to drop the index
module.exports = Student;
module.exports.dropSingleRollNoIndex = dropSingleRollNoIndex;
