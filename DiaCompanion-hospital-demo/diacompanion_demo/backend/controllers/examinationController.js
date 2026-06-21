const fs = require("fs");
const os = require("os");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const Examination = require("../models/Examination");
const { runPythonModule } = require("../utils/runPythonModule");

const VALID_MODULES = [1, 2, 3, 4, 5];

// MongoDB's hard document size limit is 16MB. Base64 inflates raw bytes by
// ~33%, so we resize before storing to stay comfortably under that limit
// for high-resolution fundus/OCT captures (e.g. ~4000px wide originals).
// This only affects the copy saved in MongoDB - the original, full-resolution
// buffer is still what gets sent to the Python AI scripts below, since each
// model already resizes internally to its own expected input size (512/768/224px).
const MAX_STORED_DIMENSION = 1600;

async function resizeForStorage(buffer) {
  return sharp(buffer)
    .resize({
      width: MAX_STORED_DIMENSION,
      height: MAX_STORED_DIMENSION,
      fit: "inside",
      withoutEnlargement: true
    })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * POST /api/examinations
 * Body: multipart/form-data with fields:
 *   - image       (file)
 *   - imageType   ("fundus" | "oct")
 *   - patientName (optional string)
 *   - modules     (optional, comma-separated module numbers to run immediately, e.g. "1,2,3")
 *
 * Stores the image as Base64 in MongoDB, then (optionally) runs the requested
 * AI modules against it and stores their results in the same document.
 */
async function createExamination(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded (field name: 'image')" });
    }

    const { imageType, patientName, modules } = req.body;
    if (!imageType || !["fundus", "oct"].includes(imageType)) {
      return res.status(400).json({ error: "imageType must be 'fundus' or 'oct'" });
    }

    // Encode a resized copy as Base64 for storage in MongoDB (stays under the
    // 16MB document limit even for very high-resolution captures).
    const resizedBuffer = await resizeForStorage(req.file.buffer);
    const imageBase64 = resizedBuffer.toString("base64");

    const examination = await Examination.create({
      patientName: patientName || "Demo Patient",
      imageType,
      imageBase64,
      originalFileName: req.file.originalname
    });

    // If the caller asked to run specific modules right away, do so.
    // Note: AI inference uses the ORIGINAL full-resolution buffer, not the
    // resized storage copy, since each model resizes internally anyway.
    const requestedModules = (modules || "")
      .split(",")
      .map((m) => parseInt(m.trim(), 10))
      .filter((m) => VALID_MODULES.includes(m));

    if (requestedModules.length > 0) {
      await runModulesAndUpdate(examination, req.file.buffer, requestedModules);
    }

    return res.status(201).json({ examination });
  } catch (err) {
    console.error("createExamination error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/examinations/:id/run/:moduleNumber
 * Runs a single AI module against an already-stored examination's image
 * (decoded back from Base64 to a temp file) and saves the result.
 */
async function runSingleModule(req, res) {
  try {
    const { id, moduleNumber } = req.params;
    const modNum = parseInt(moduleNumber, 10);
    if (!VALID_MODULES.includes(modNum)) {
      return res.status(400).json({ error: "moduleNumber must be between 1 and 5" });
    }

    const examination = await Examination.findById(id);
    if (!examination) {
      return res.status(404).json({ error: "Examination not found" });
    }

    // NOTE: this decodes the RESIZED storage copy (max 1600px), not the
    // original full-resolution upload, since only the resized copy is kept
    // in MongoDB. Results from a module run here may therefore differ very
    // slightly from a run triggered immediately at upload time (which used
    // the original-resolution buffer). For this demo, 1600px is still well
    // above every model's actual input resolution (512/768/224px), so this
    // has no meaningful effect on prediction quality.
    const imageBuffer = Buffer.from(examination.imageBase64, "base64");
    await runModulesAndUpdate(examination, imageBuffer, [modNum]);

    return res.status(200).json({ examination });
  } catch (err) {
    console.error("runSingleModule error:", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/examinations
 * Returns all examinations (without the heavy Base64 field, for a fast list view).
 */
async function listExaminations(req, res) {
  try {
    const examinations = await Examination.find()
      .select("-imageBase64")
      .sort({ createdAt: -1 });
    return res.status(200).json({ examinations });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/examinations/:id
 * Returns one examination including its Base64 image (decoded into a data URI
 * the frontend can use directly in an <img src="..."> tag).
 */
async function getExamination(req, res) {
  try {
    const examination = await Examination.findById(req.params.id);
    if (!examination) {
      return res.status(404).json({ error: "Examination not found" });
    }
    // The stored copy is always JPEG (resizeForStorage always re-encodes to
    // JPEG before saving), so this is no longer a guess.
    const mimeGuess = "image/jpeg";
    const imageDataUri = `data:${mimeGuess};base64,${examination.imageBase64}`;
    return res.status(200).json({ examination, imageDataUri });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * Helper: writes the image buffer to a temp file, runs each requested module
 * via the Python subprocess bridge, stores results on the examination doc.
 */
async function runModulesAndUpdate(examination, imageBuffer, moduleNumbers) {
  const tempPath = path.join(os.tmpdir(), `${uuidv4()}.jpg`);
  fs.writeFileSync(tempPath, imageBuffer);

  try {
    for (const modNum of moduleNumbers) {
      const output = await runPythonModule(modNum, tempPath);
      examination.results[`module${modNum}`] = output;
    }
    await examination.save();
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

module.exports = {
  createExamination,
  runSingleModule,
  listExaminations,
  getExamination
};
