import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Role } from "@/types/models";
import { AppShell } from "@/components/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { TriagePage } from "@/pages/TriagePage";
import { PatientsPage, PatientRecordPage } from "@/pages/PatientsPage";
import { ProgressionPage } from "@/pages/ProgressionPage";
import { ConflictsPage, DashboardPage, AdminConfigPage, NotFoundPage } from "@/pages/AdminPages";

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { hasRole } = useAuth();
  return hasRole(...roles) ? <>{children}</> : <Navigate to="/" replace />;
}

// Central route table.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<TriagePage />} />
        <Route path="patients" element={<PatientsPage />} />
        <Route path="patients/:id" element={<PatientRecordPage />} />
        <Route path="progression" element={<ProgressionPage />} />
        <Route path="progression/:patientId" element={<ProgressionPage />} />
        <Route
          path="conflicts"
          element={
            <RequireRole roles={["Admin"]}>
              <ConflictsPage />
            </RequireRole>
          }
        />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route
          path="admin"
          element={
            <RequireRole roles={["Admin"]}>
              <AdminConfigPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
