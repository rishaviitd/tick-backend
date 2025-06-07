/**
 * Grading Controller
 * Handles PDF submissions: converts each page to image, uploads to Cloudinary, updates student assignment.
 */

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
    // Upload PDF as an image resource to capture page count
    const pdfDataUri = `data:application/pdf;base64,${buffer.toString(
      "base64"
    )}`;
    const uploadResult = await cloudinary.uploader.upload(pdfDataUri, {
      resource_type: "image",
    });
    // Generate a PNG URL for each page via dynamic transformations
    const urls = [];
    for (let i = 1; i <= uploadResult.pages; i++) {
      urls.push(
        cloudinary.url(uploadResult.public_id, {
          resource_type: "image",
          format: "png",
          page: i,
          width: 1024,
          height: 768,
          quality: 100,
        })
      );
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
