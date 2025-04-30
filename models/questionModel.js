const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, "Question must have a text"],
  },
  maxMarks: {
    type: Number,
    default: 0,
  },
  questionType: {
    type: String,
    enum: ["mcq", "subjective"],
    default: "subjective",
  },
  rubric: {
    type: String,
    default: "",
  },
  order: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("Question", questionSchema);
