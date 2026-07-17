import { HashRouter } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { AppRoutes } from "@/routes";

// HashRouter works both on the web and when the built bundle is loaded from
// file:// inside Electron — no extra config needed to package.
export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <DataProvider>
          <AppRoutes />
        </DataProvider>
      </AuthProvider>
    </HashRouter>
  );
}
