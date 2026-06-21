const express = require("express");
const multer = require("multer");
const {
  createExamination,
  runSingleModule,
  listExaminations,
  getExamination
} = require("../controllers/examinationController");

const router = express.Router();

// Store the uploaded file in memory; we convert it to Base64 ourselves
// before saving to MongoDB (no need to write to disk for the upload step).
const upload = multer({ storage: multer.memoryStorage() });

// Create a new examination (uploads image, optionally runs AI modules immediately)
router.post("/", upload.single("image"), createExamination);

// List all examinations (lightweight, no image payload)
router.get("/", listExaminations);

// Get one examination including its image
router.get("/:id", getExamination);

// Run a specific AI module (1-5) against an existing examination's stored image
router.post("/:id/run/:moduleNumber", runSingleModule);

module.exports = router;
