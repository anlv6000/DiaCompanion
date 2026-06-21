# DiaCompanion - Local Demo Build

Minimal, security-free demo build for the hospital meeting. No login, no
JWT, no production hardening - this exists purely to show the 5 AI modules
working end-to-end through a real UI and a real database.

## Architecture

```
React (frontend, port 3000)
        |  multipart/form-data POST
        v
Express (backend, port 5000)
        |  encode image -> Base64 -> save to MongoDB
        |  decode Base64 -> write temp file -> spawn python predict.py
        v
Python scripts (backend/ai_scripts/model_1 .. model_5)
        |  load .pth/.keras/.pkl weights, run inference
        v
JSON printed to stdout -> parsed by Express -> saved back onto the
MongoDB document -> returned to the frontend
```

No FastAPI, no .NET, no JWT/RBAC, no MongoDB Atlas schema migrations -
this is intentionally the simplest version that still uses the real model
weights and a real database.

## 1. Folder structure

```
backend/
  server.js                      <- entry point
  routes/examinationRoutes.js
  controllers/examinationController.js
  models/Examination.js          <- Mongoose schema (stores image as Base64)
  utils/runPythonModule.js       <- spawns the Python scripts
  ai_scripts/
    requirements.txt
    model_1/predict.py           <- DR Grading (EfficientNet-B4 ensemble)
      weights/                   <- put your .pth files here
      outputs/                   <- generated mask/overlay images land here
    model_2/predict.py           <- Lesion Segmentation (U-Net, Keras)
      weights/                   <- best_model.keras goes here
    model_3/predict.py           <- Fractal Dimension (vessel U-Net + box-counting)
      weights/                   <- best_model.keras goes here
    model_4/predict.py           <- OCT Classification (Keras, 4-class -> remapped to 3)
      weights/                   <- best_oct_v2.keras goes here
    model_5/predict.py           <- OCT Layer Segmentation + DME (U-Net + Random Forest)
      weights/                   <- best_unet.pth, rf_dme_classifier.pkl,
                                     normal_thickness_reference.csv go here
  .env
  package.json

frontend/
  src/
    App.tsx                      <- router, lands directly on HomePage (no login)
    main.tsx
    api.ts                       <- all backend calls live here
    pages/HomePage.tsx            <- upload + run modules + view results
    components/ModuleResultCard.tsx
  index.html
  package.json
  vite.config.ts
```

## 2. Where to put your model weight files

Copy your existing files exactly into these paths (filenames must match,
since the scripts reference them directly):

| Module | File(s) to copy | Destination |
|---|---|---|
| 1 - DR Grading | `efficientnet_b4_fold0_best.pth` ... `fold4_best.pth` (up to 5 folds) | `backend/ai_scripts/model_1/weights/` |
| 2 - Lesion Segmentation | `best_model.keras` (the TJDR lesion U-Net) | `backend/ai_scripts/model_2/weights/` |
| 3 - Fractal Dimension | `best_model.keras` (the FIVES vessel U-Net) | `backend/ai_scripts/model_3/weights/` |
| 4 - OCT Classification | `best_oct_v2.keras` | `backend/ai_scripts/model_4/weights/` |
| 5 - OCT Layer Segmentation | `best_unet.pth`, `rf_dme_classifier.pkl`, `normal_thickness_reference.csv` | `backend/ai_scripts/model_5/weights/` |

Module 2 and Module 3 both load a file named `best_model.keras` from their
own `weights/` folder - they are two separate files, just give them the
same name in their own module folder, no renaming logic needed in code.

## 3. Backend setup

```bash
cd backend
npm install
```

Edit `.env` and put in your real MongoDB Atlas password:

```dotenv
MONGODB_URI=mongodb+srv://anlevan001:YOUR_REAL_PASSWORD@cluster0.02suo.mongodb.net/diacompanion?retryWrites=true&w=majority
PORT=5000
PYTHON_BIN=python3
```

If your machine only has `python` (not `python3`) on PATH, change
`PYTHON_BIN=python` instead.

Install Python dependencies (use a virtual environment if you prefer):

```bash
cd ai_scripts
pip install -r requirements.txt
```

Start the backend:

```bash
cd backend
npm run dev
```

You should see:
```
MongoDB connected
DiaCompanion demo backend running on http://localhost:5000
```

## 4. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. It opens directly on the working page - no
login screen.

## 5. Using the demo

1. Select image type (Fundus or OCT) - this filters which module buttons appear.
2. Choose an image file, click "Upload to Examination".
3. Click "Run Module X" for any module relevant to that image type.
4. Results (numbers, masks, overlays, heatmaps) render live in the results
   grid below.

Each click re-reads the image back out of MongoDB (decoded from the stored
Base64 string), writes it to a temp file, and runs the corresponding
Python script against it - exactly mirroring how a real deployment would
read stored patient images before running inference.

## 6. API reference (for quick manual testing with curl/Postman)

```
POST   /api/examinations                       multipart: image, imageType, patientName, modules
GET    /api/examinations                       list all (no image payload)
GET    /api/examinations/:id                   one record + imageDataUri
POST   /api/examinations/:id/run/:moduleNumber  run module 1-5 against stored image
GET    /api/health                              liveness check
```

## 7. Known simplifications (do not carry these into the real v1.0 system)

- No authentication, no RBAC, no rate limiting.
- No FastAPI microservices - Python scripts are invoked directly via
  `child_process.spawn`, which is fine for a single local demo machine but
  would not scale to concurrent users.
- Images are stored as Base64 strings directly inside MongoDB documents
  instead of a dedicated object store (S3/GridFS) - acceptable for demo
  image sizes, not appropriate for production volume.
- No FHIR export, no risk-alert engine, no longitudinal tracking - those
  remain part of the full v1.0 scope described in Report 2.
