import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { resolveLandingRoute } from "@/lib/permissions";
import { Field, Button, Panel, PageHeader, StatusBadge } from "@/components/ui";

/* Đăng nhập — CHỈ nhân viên bằng email. Web bệnh viện không có luồng bệnh nhân
   (OTP/số điện thoại), luồng đó thuộc app bệnh nhân riêng. */
export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-side">
          <h1>DiaCompanion</h1>
          <p>Console lâm sàng hỗ trợ sàng lọc bệnh võng mạc đái tháo đường.</p>
          <div className="stack">
            <StatusBadge text="AI chỉ hỗ trợ quyết định" kind="defer" />
            <span>• Ca chưa xác nhận luôn được chuyển bác sĩ.</span>
            <span>• Tin cậy và bất đồng hiển thị trực tiếp.</span>
            <span>• Hồ sơ lâm sàng dùng cơ chế void, không xóa cứng.</span>
          </div>
        </div>
        <form className="login-form" onSubmit={submit}>
          <h2 className="serif">Đăng nhập</h2>
          <p className="faint">
            Dành cho nhân viên bệnh viện (Bác sĩ, Điều dưỡng, Quản trị).
          </p>
          <Field labelText="Email" required>
            <input
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="bs.an@diacompanion.vn"
            />
          </Field>
          <Field labelText="Mật khẩu" required>
            <div className="input-with-action">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="button" onClick={() => setShowPassword((x) => !x)}>
                {showPassword ? "Ẩn" : "Hiện"}
              </Button>
            </div>
          </Field>
          {error && <div className="state error">{error}</div>}
          <Button
            kind="primary"
            type="submit"
            busy={busy}
            disabled={!email || !password}
            style={{ width: "100%", justifyContent: "center" }}
          >
            Đăng nhập
          </Button>
          <div className="split" style={{ marginTop: 10 }}>
            <span className="faint small">
              Quên mật khẩu? Liên hệ quản trị viên để cấp lại.
            </span>
            <span className="faint small">Backend: localhost:5080</span>
          </div>
        </form>
      </div>
    </div>
  );
}

/* Đổi mật khẩu khi đã đăng nhập (bắt buộc nếu đang dùng mật khẩu tạm). */
export function ChangePasswordPage() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError("Hai mật khẩu mới chưa trùng khớp.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      toast.push("Đã cập nhật mật khẩu.", "success");
      setCurrent("");
      setNext("");
      setConfirm("");
      // Điều hướng theo vai trò về trang chủ an toàn (không hardcode /triage,
      // không rơi vào /home vốn không tồn tại trên web console).
      navigate(resolveLandingRoute(user?.role, user?.defaultRoute), {
        replace: true,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Đổi mật khẩu"
        subtitle={
          user?.mustChangePassword
            ? "Bạn phải đổi mật khẩu tạm trước khi tiếp tục."
            : "Cập nhật thông tin xác thực của tài khoản đang đăng nhập."
        }
      />
      <Panel>
        <form onSubmit={submit} style={{ maxWidth: 460 }}>
          <Field labelText="Mật khẩu hiện tại" required>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field labelText="Mật khẩu mới" required>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field labelText="Nhập lại mật khẩu mới" required>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          {error && <div className="state error">{error}</div>}
          <Button kind="primary" type="submit" busy={busy}>
            Cập nhật mật khẩu
          </Button>
        </form>
      </Panel>
    </>
  );
}
