const mongoose = require("mongoose");

const studentAssignmentSchema = new mongoose.Schema({
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Assignment",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "processing", "graded", "failed"],
    default: "pending",
  },
  submissionDate: {
    type: Date,
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
        default: "",
      },
      // Store AI steps breakdown for student's response
      stepsBreakdown: {
        studentThoughtProcess: { type: String, default: "" },
        steps: {
          type: [
            {
              stepNumber: { type: Number, required: true },
              studentWork: { type: String, required: true },
              studentIntent: { type: String, required: true },
            },
          ],
          default: [],
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
    // No unique constraint here
  },
  rollNo: {
    type: String,
    default: "",
    index: false, // Ensure no separate index is created for this field
  },
  // Change class field to classes array to allow students to be in multiple classes
  classes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
    },
  ],

  assignments: {
    type: [studentAssignmentSchema],
    default: [],
  },
});

// Create a compound index for rollNo and classes to ensure uniqueness only within a class
studentSchema.index(
  { rollNo: 1, classes: 1 },
  {
    unique: true,
    // Skip the constraint check if rollNo is empty
    partialFilterExpression: { rollNo: { $ne: "" } },
  }
);

// Create the model
const Student = mongoose.model("Student", studentSchema);

// This code will attempt to drop any existing indexes we don't want
const dropUnwantedIndexes = async () => {
  try {
    // Get collection info to find the index names
    const collection = Student.collection;
    const indexInfo = await collection.indexInformation();

    // Look for mobileNo unique index that we want to drop
    for (const [indexName, indexFields] of Object.entries(indexInfo)) {
      // Drop the mobileNo unique index
      if (
        indexFields.length === 1 &&
        indexFields[0][0] === "mobileNo" &&
        indexName !== "_id_"
      ) {
        console.log(`Dropping mobileNo index: ${indexName}`);
        await collection.dropIndex(indexName);
      }

      // Also drop the old rollNo and class index if it exists
      if (
        indexFields.length === 2 &&
        indexFields[0][0] === "rollNo" &&
        indexFields[1][0] === "class" &&
        indexName !== "_id_"
      ) {
        console.log(`Dropping old rollNo_class index: ${indexName}`);
        await collection.dropIndex(indexName);
      }
    }
    console.log("Finished checking and dropping unwanted indexes");
  } catch (error) {
    console.error("Error dropping indexes:", error);
  }
};

// Export both the model and the function to drop unwanted indexes
module.exports = Student;
module.exports.dropUnwantedIndexes = dropUnwantedIndexes;
