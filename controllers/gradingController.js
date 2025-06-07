/**
 * Grading Controller
 * Handles PDF submissions: converts each page to image, uploads to Cloudinary, updates student assignment.
 */

const { fromBuffer } = require("pdf2pic");
const cloudinary = require("cloudinary").v2;
const Student = require("../models/studentModel");

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.uploadSubmission = async (req, res) => {
  const { studentId, assignmentId } = req.body;
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }

  try {
    const urls = await handlePdfUpload(
      req.file.buffer,
      studentId,
      assignmentId
    );
    return res
      .status(200)
      .json({ success: true, message: "Submission processed", urls });
  } catch (error) {
    console.error("uploadSubmission error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

async function handlePdfUpload(buffer, studentId, assignmentId) {
  try {
    const options = {
      density: 100,
      format: "png",
      width: 1024,
      height: 768,
      quality: 100,
    };
    const convert = fromBuffer(buffer, options);
    // Convert all pages (-1 indicates all)
    const images = await convert.bulk(-1, { responseType: "base64" });

    const urls = [];
    for (const base64 of images) {
      const dataUri = `data:image/png;base64,${base64}`;
      const result = await cloudinary.uploader.upload(dataUri);
      urls.push(result.secure_url);
    }

    const student = await Student.findById(studentId);
    if (!student) throw new Error(`Student not found: ${studentId}`);

    const assignmentEntry = student.assignments.find(
      (entry) => entry.assignment.toString() === assignmentId
    );
    if (!assignmentEntry)
      throw new Error(
        `Assignment entry not found for assignment ${assignmentId}`
      );

    assignmentEntry.responses = urls;
    assignmentEntry.submissionDate = new Date();

    await student.save();
    console.log(
      `Processed submission for student ${studentId}, assignment ${assignmentId}`
    );
    return urls;
  } catch (error) {
    console.error("Error processing submission:", error);
    throw error;
  }
}
