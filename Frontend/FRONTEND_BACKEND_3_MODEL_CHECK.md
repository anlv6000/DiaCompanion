# DiaCompanion — Frontend/Backend check for 3 AI models

## 1. Critical mismatches fixed

1. `POST /api/admin/models` on backend requires `modelType` (`1=DR`, `2=Lesion`, `3=Fractal`), but the old frontend did not send it. Result: register model could return HTTP 400 because enum value became 0.
2. Backend `ModelVersionDto` returns `modelType` and `modelTypeLabel`; frontend types/UI did not contain them.
3. Backend `AiDiagnosisDto` returns three model versions (`drModelVersion`, `lesionModelVersion`, `fractalModelVersion`); old frontend only displayed legacy `modelVersion` (DR).
4. Old frontend text said only one model could be active. Backend now allows one active version per model type, so up to three active versions at the same time.
5. `DataContext` cached only the first active model. It now caches the list of active models.
6. Dashboard backend already returns `periodFrom`, `periodTo`, `modelVersionId`, `scope`, and `referralRate`; old frontend types/UI did not use all of these.
7. Dashboard model filtering in backend was inconsistent: diagnoses/reviews were filtered by `modelVersionId`, but visits/patients/referrals were not. The backend repository was patched so all dashboard KPIs use the same filtered visit population.

## 2. Frontend behavior after the change

### Model administration

- Model registration requires selecting: DR / Lesion / Fractal.
- UI shows three active-model cards.
- Pipeline is marked ready only when all three model types have an active version.
- Activating a model explains that only the old active model of the same type is deactivated.
- Delete button matches backend rules: cannot delete active, previously activated, or referenced versions.

### AI result screen

The result screen shows:

- DR model version
- Lesion model version
- Fractal model version
- DR grade + confidence
- lesion implied grade and lesion counts
- disagreement / deferral
- fractal dimension and fractal output image

`POST /api/diagnoses/run/{imageId}` remains one frontend action. Backend decides which three active model versions to use and calls the three Python inference endpoints.

## 3. Admin dashboard/chart flow

### KPI flow

`DashboardPage` -> `GET /api/admin/dashboard?from=&to=&modelVersionId=` -> `AdminService.Dashboard()` -> `EfRepository.GetDashboardStatsAsync()`.

Backend calculates:

- Total patients
- Visits in selected period
- Pending triage
- Deferred pending
- Deferral rate = deferred diagnoses / diagnoses
- Referral rate = ophthalmology-or-urgent completed visits / completed visits
- Override rate = override reviews / reviews
- Grade distribution = `DiagnosisReview.FinalGrade` distribution (doctor-confirmed grade)

Because grade distribution comes from reviews, the frontend title was changed to **doctor-confirmed DR grade distribution** rather than implying it is raw AI output.

### DR grade bars

The backend returns `gradeDistribution` as counts by grade label. `GradeBars` renders 5 bars: Normal, Mild, Moderate, Severe, PDR. Bar width is relative to the largest count.

### Confidence threshold -> projected deferral line

This is not a time-series chart. Frontend queries:

`GET /api/admin/configs/threshold-impact?key=ai.confidence_threshold&proposed=X`

for X = `0.1, 0.2, ..., 0.9`.

Backend recalculates projected deferred cases over historical diagnoses while keeping the current disagreement threshold. Frontend plots proposed confidence threshold on X and projected deferral rate (%) on Y.

The old SVG chart did not display X-axis labels. It now renders X ticks, Y grid lines, points/tooltips, and axis labels.

Important: threshold-impact currently uses all historical diagnoses and has no date/model filter. The frontend explicitly labels this so users do not mistake it for the filtered dashboard population.

## 4. Remaining backend design note

`DashboardDto.ActiveModel` is still one formatted string such as:

`Dr: dr-v3 | Lesion: lesion-v2 | Fractal: vessel-v1`

The frontend parses this for display. A cleaner future API would return a structured `activeModels[]` array, but this is not required for the current frontend/backend pair to work.

`appsettings.json` still contains `AiService:UseStub`, while the current `AiInferenceClient` does not read that setting. Therefore toggling `UseStub` currently has no effect. Decide whether to remove that setting or restore explicit stub behavior before relying on it in local development.
