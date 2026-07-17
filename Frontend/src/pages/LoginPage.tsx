import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Field, Input, Panel } from "@/components/ui/primitives";
import { ApiError } from "@/lib/apiClient";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("an.doctor@diacompanion.local");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Email hoặc mật khẩu không đúng."
          : "Không kết nối được máy chủ. Kiểm tra backend đang chạy ở localhost:5080.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center bg-canvas">
      <Panel className="w-[360px] p-6">
        <div className="mb-5">
          <h1 className="font-serif text-section text-ink">DiaCompanion</h1>
          <p className="text-meta text-ink-faint mt-1">Console lâm sàng — đăng nhập</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </Field>
          <Field label="Mật khẩu">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          {error && <div className="text-meta text-risk-alert">{error}</div>}
          <Button type="submit" variant="primary" className="w-full justify-center" disabled={busy}>
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
        </form>
        <p className="mt-4 text-micro text-ink-faint">
          Mẫu: an.doctor@diacompanion.local · admin@diacompanion.local — mật khẩu Password123!
        </p>
      </Panel>
    </div>
  );
}
