const mongoose = require("mongoose");

const examinationSchema = new mongoose.Schema(
  {
    patientName: {
      type: String,
      default: "Demo Patient"
    },
    imageType: {
      type: String,
      enum: ["fundus", "oct"],
      required: true
    },
    // The uploaded image is stored as a Base64 string (decoded back to a buffer when read).
    imageBase64: {
      type: String,
      required: true
    },
    originalFileName: {
      type: String
    },
    // Which module(s) were run against this image, and their raw JSON results.
    results: {
      module1: { type: mongoose.Schema.Types.Mixed, default: null }, // DR Grading
      module2: { type: mongoose.Schema.Types.Mixed, default: null }, // Lesion Segmentation
      module3: { type: mongoose.Schema.Types.Mixed, default: null }, // Fractal Dimension
      module4: { type: mongoose.Schema.Types.Mixed, default: null }, // OCT Classification
      module5: { type: mongoose.Schema.Types.Mixed, default: null }  // OCT Layer Segmentation
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Examination", examinationSchema);
