import { type ReactElement } from "react";
import {
  Routes,
  Route,
  Navigate,
  useParams,
  useLocation,
} from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { resolveLandingRoute } from "@/lib/permissions";
import { AppShell } from "@/components/AppShell";
import type { Role } from "@/types/api";

import { LoginPage, ChangePasswordPage } from "@/pages/AuthPages";
import { TriagePage } from "@/pages/TriagePage";
import { PatientsPage, PatientFormPage } from "@/pages/PatientsPage";
import { PatientDetailPage } from "@/pages/PatientDetailPage";
import { FundusPage } from "@/pages/FundusPage";
import { RecheckPage } from "@/pages/RecheckPage";
import { DoctorVisitsPage } from "@/pages/DoctorVisitsPage";
import {
  ReceptionNewVisitPage,
  ReceptionVisitsPage,
  ReceptionShiftsPage,
} from "@/pages/ReceptionPages";
import { ProgressionPage } from "@/pages/ProgressionPage";
import { VisitReportPage } from "@/pages/VisitReportPage";
import { UsersPage } from "@/pages/UsersPage";
import { BlogPage, FeedbackPage, SymptomsPage } from "@/pages/EngagementPages";
import {
  DashboardPage,
  ConflictsPage,
  ConfigsPage,
  ModelsPage,
  AuditPage,
} from "@/pages/AdminPages";

/* ------- Cổng bảo vệ: yêu cầu đăng nhập + đúng vai trò ------- */
function RequireAuth({
  children,
  roles,
}: {
  children: ReactElement;
  roles?: Role[];
}) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  // Bắt buộc đổi mật khẩu tạm trước khi vào bất kỳ trang nào khác.
  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  if (roles && !roles.includes(user.role)) return <Forbidden />;
  return <AppShell>{children}</AppShell>;
}

function Forbidden() {
  return (
    <div className="state error" style={{ margin: 24 }}>
      <b>Không đủ quyền truy cập</b>
      <div>
        Tài khoản của bạn không có quyền mở trang này. Liên hệ quản trị viên nếu
        cần.
      </div>
    </div>
  );
}

/* ------- Wrapper đọc tham số URL rồi truyền prop cho page ------- */
function PatientDetailRoute() {
  const { id } = useParams();
  return <PatientDetailPage id={Number(id)} />;
}
function PatientEditRoute() {
  const { id } = useParams();
  return <PatientFormPage id={Number(id)} />;
}
function FundusRoute() {
  const { imageId } = useParams();
  return <FundusPage imageId={Number(imageId)} />;
}
function ProgressionOneRoute() {
  const { id } = useParams();
  return <ProgressionPage patientId={Number(id)} />;
}
function VisitReportRoute() {
  const { visitId } = useParams();
  return <VisitReportPage visitId={Number(visitId)} />;
}

/* ------- Bảng route ------- */
export function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Công khai */}
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={resolveLandingRoute(user.role, user.defaultRoute)} replace />
          ) : (
            <LoginPage />
          )
        }
      />

      {/* Đổi mật khẩu: chỉ cần đăng nhập (không gác vai trò), không bọc AppShell khi buộc đổi */}
      <Route
        path="/change-password"
        element={
          user ? (
            <AppShell>
              <ChangePasswordPage />
            </AppShell>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Lâm sàng */}
      <Route
        path="/triage"
        element={
          <RequireAuth roles={["Doctor", "Admin"]}>
            <TriagePage />
          </RequireAuth>
        }
      />
      <Route
        path="/patients"
        element={
          <RequireAuth roles={["Doctor", "Nurse", "Admin", "Receptionist"]}>
            <PatientsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/patients/new"
        element={
          <RequireAuth roles={["Doctor", "Nurse", "Admin"]}>
            <PatientFormPage />
          </RequireAuth>
        }
      />
      <Route
        path="/patients/:id/edit"
        element={
          <RequireAuth roles={["Doctor", "Nurse", "Admin"]}>
            <PatientEditRoute />
          </RequireAuth>
        }
      />
      <Route
        path="/patients/:id"
        element={
          <RequireAuth roles={["Doctor", "Nurse", "Admin", "Receptionist"]}>
            <PatientDetailRoute />
          </RequireAuth>
        }
      />
      <Route
        path="/fundus/:imageId"
        element={
          <RequireAuth roles={["Doctor", "Nurse", "Admin"]}>
            <FundusRoute />
          </RequireAuth>
        }
      />
      <Route
        path="/recheck"
        element={
          <RequireAuth roles={["Doctor", "Nurse", "Admin", "Receptionist"]}>
            <RecheckPage />
          </RequireAuth>
        }
      />
      <Route
        path="/my-visits"
        element={
          <RequireAuth roles={["Doctor"]}>
            <DoctorVisitsPage />
          </RequireAuth>
        }
      />
      {/* ===== Tiếp đón (lễ tân) ===== */}
      <Route
        path="/reception/patients/new"
        element={
          <RequireAuth roles={["Receptionist"]}>
            <PatientFormPage />
          </RequireAuth>
        }
      />
      <Route
        path="/reception/visits/new"
        element={
          <RequireAuth roles={["Receptionist"]}>
            <ReceptionNewVisitPage />
          </RequireAuth>
        }
      />
      <Route
        path="/reception/visits"
        element={
          <RequireAuth roles={["Receptionist", "Admin"]}>
            <ReceptionVisitsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/reception/shifts"
        element={
          <RequireAuth roles={["Receptionist", "Admin"]}>
            <ReceptionShiftsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/progression"
        element={
          <RequireAuth roles={["Doctor", "Nurse", "Admin"]}>
            <ProgressionPage />
          </RequireAuth>
        }
      />
      <Route
        path="/progression/:id"
        element={
          <RequireAuth roles={["Doctor", "Nurse", "Admin"]}>
            <ProgressionOneRoute />
          </RequireAuth>
        }
      />
      <Route
        path="/symptoms"
        element={
          <RequireAuth roles={["Doctor"]}>
            <SymptomsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/reports/visit/:visitId"
        element={
          <RequireAuth roles={["Doctor", "Nurse", "Admin"]}>
            <VisitReportRoute />
          </RequireAuth>
        }
      />

      {/* Báo cáo */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth roles={["Doctor", "Admin"]}>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/conflicts"
        element={
          <RequireAuth roles={["Admin"]}>
            <ConflictsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/blog"
        element={
          <RequireAuth roles={["Doctor", "Admin"]}>
            <BlogPage />
          </RequireAuth>
        }
      />
      <Route
        path="/feedback"
        element={
          <RequireAuth roles={["Admin"]}>
            <FeedbackPage />
          </RequireAuth>
        }
      />

      {/* Quản trị */}
      <Route
        path="/users"
        element={
          <RequireAuth roles={["Admin"]}>
            <UsersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/configs"
        element={
          <RequireAuth roles={["Admin"]}>
            <ConfigsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/models"
        element={
          <RequireAuth roles={["Admin"]}>
            <ModelsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/audit"
        element={
          <RequireAuth roles={["Admin"]}>
            <AuditPage />
          </RequireAuth>
        }
      />

      {/* Mặc định */}
      <Route
        path="/"
        element={<Navigate to={resolveLandingRoute(user?.role, user?.defaultRoute)} replace />}
      />
      <Route
        path="*"
        element={
          <Navigate
            to={user ? resolveLandingRoute(user.role, user.defaultRoute) : "/login"}
            replace
          />
        }
      />
    </Routes>
  );
}
