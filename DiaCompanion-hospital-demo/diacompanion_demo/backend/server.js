require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const examinationRoutes = require("./routes/examinationRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// No auth/security middleware on purpose — this is a local demo build only.
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "DiaCompanion demo backend is running" });
});

app.use("/api/examinations", examinationRoutes);

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => {
      console.log(`DiaCompanion demo backend running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });
