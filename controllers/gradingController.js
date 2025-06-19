/**
 * Grading Controller
 * Handles PDF submissions: converts each page to image, uploads to Cloudinary, updates student assignment.
 */

const cloudinary = require("cloudinary").v2;
const Student = require("../models/studentModel");
const axios = require("axios");
const Assignment = require("../models/assignmentModel");
const { URL } = require("url");

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

    // Generate URLs for each page
    const urls = [];
    for (let i = 1; i <= uploadResult.pages; i++) {
      const url = cloudinary.url(uploadResult.public_id, {
        resource_type: "image",
        format: "png",
        page: i,
        sign_url: true,
      });
      urls.push(url);
    }

    // Phase 1: find student and mark submission date
    const student = await Student.findById(studentId);
    if (!student) throw new Error(`Student not found: ${studentId}`);
    const assignmentEntry = student.assignments.find(
      (entry) => entry.assignment.toString() === assignmentId
    );
    if (!assignmentEntry)
      throw new Error(
        `Assignment entry not found for assignment ${assignmentId}`
      );
    // Update submission date
    assignmentEntry.submissionDate = new Date();
    await student.save();

    // Phase 2: request cropped answer uploads from FastAPI
    const fastApiUrl = process.env.FAST_API_URL;
    if (!fastApiUrl) {
      throw new Error("FAST_API_URL is not defined");
    }
    // Use FAST_API_URL directly for cropping with extended timeout
    console.log(
      `[handlePdfUpload] Sending ${urls.length} URLs to FastAPI: ${fastApiUrl}`
    );
    console.log(`[handlePdfUpload] URLs: ${JSON.stringify(urls)}`);

    let data;
    try {
      const response = await axios.post(
        fastApiUrl,
        { urls },
        {
          timeout: 300000, // 5 minutes timeout to handle heavy processing
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      data = response.data;
      console.log(
        `[handlePdfUpload] FastAPI response successful: ${JSON.stringify(data)}`
      );
    } catch (error) {
      console.error(`[handlePdfUpload] FastAPI request failed:`, error.message);
      if (error.code === "ECONNABORTED") {
        throw new Error(
          "FastAPI request timed out - processing is taking longer than expected"
        );
      } else if (error.response) {
        throw new Error(
          `FastAPI returned error ${error.response.status}: ${error.response.data}`
        );
      } else if (error.request) {
        // Network error - service might be down or starting up
        throw new Error(
          "Unable to connect to grading service - it may be starting up or temporarily unavailable"
        );
      } else {
        throw new Error(`FastAPI request error: ${error.message}`);
      }
    }
    // Expect data.uploads to be an array of { question_id, image_url }
    const uploads = data.uploads;
    // Build final responses matching new schema
    const finalResponses = uploads.map((u) => ({
      question_id: u.question_id,
      image_url: u.image_url,
    }));
    // Note: we defer saving until full grading to satisfy schema requirements

    // Skip grading - we're not storing grading data anymore
    // Just use the question_id and image_url from finalResponses
    const combinedResponses = finalResponses.map((resp) => {
      return {
        question_id: resp.question_id,
        image_url: resp.image_url,
      };
    });
    // Persist the full grading breakdown
    assignmentEntry.responses = combinedResponses;
    assignmentEntry.status = "graded";
    await student.save();
    console.log(
      `Grading complete for student ${studentId}, assignment ${assignmentId}`
    );
    return combinedResponses;
  } catch (error) {
    console.error("Error processing submission:", error);
    throw error;
  }
}
