const { spawn } = require("child_process");
const path = require("path");

/**
 * Runs the predict.py script for a given module against a temp image file
 * and resolves with the parsed JSON result printed to stdout.
 *
 * @param {number} moduleNumber  1-5
 * @param {string} imagePath     absolute path to a temp image file on disk
 * @returns {Promise<object>}    parsed JSON: { module, status, result } or { module, status, message }
 */
function runPythonModule(moduleNumber, imagePath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(
      __dirname,
      "..",
      "ai_scripts",
      `model_${moduleNumber}`,
      "predict.py"
    );

    // "python3" is used by default; override with PYTHON_BIN in .env if your
    // environment only exposes "python".
    const pythonBin = process.env.PYTHON_BIN || "python3";
    const proc = spawn(pythonBin, [scriptPath, imagePath]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (!stdout.trim()) {
        return reject(
          new Error(
            `Module ${moduleNumber} produced no output. stderr: ${stderr || "(empty)"}`
          )
        );
      }
      try {
        // The Python script may also print warnings (e.g. TensorFlow) before the
        // JSON line, so we take the LAST line that looks like JSON.
        const lines = stdout.trim().split("\n");
        const jsonLine = lines[lines.length - 1];
        const parsed = JSON.parse(jsonLine);
        resolve(parsed);
      } catch (err) {
        reject(
          new Error(
            `Failed to parse JSON from module ${moduleNumber}. Raw stdout: ${stdout} | stderr: ${stderr}`
          )
        );
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
  });
}

module.exports = { runPythonModule };
