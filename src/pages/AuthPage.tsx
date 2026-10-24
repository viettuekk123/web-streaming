import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
export function AuthPage({ register = false }: { register?: boolean }) {
  const { authenticate } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await authenticate(
        String(data.get("username")),
        String(data.get("password")),
        register ? String(data.get("confirm")) : undefined,
      );
      navigate("/");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="form-card">
      <span className="brand-icon">▶</span>
      <p className="eyebrow">CHÀO MỪNG ĐẾN BVG</p>
      <h1>{register ? "Tạo tài khoản" : "Đăng nhập"}</h1>
      <p className="muted">Chia sẻ video và tiếp tục câu chuyện của bạn.</p>
      <form onSubmit={submit}>
        <label>
          Tài khoản
          <input
            name="username"
            required
            minLength={3}
            maxLength={40}
            pattern="[a-zA-Z0-9_]+"
            autoComplete="username"
          />
        </label>
        <label>
          Mật khẩu
          <input
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete={register ? "new-password" : "current-password"}
            placeholder="Ít nhất 8 ký tự"
          />
        </label>
        {register && (
          <label>
            Xác nhận mật khẩu
            <input
              name="confirm"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "Đang xử lý…" : register ? "Tạo tài khoản" : "Đăng nhập"}
        </button>
      </form>
      <p className="muted">
        {register ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
        <Link to={register ? "/login" : "/register"}>
          {register ? "Đăng nhập" : "Đăng ký ngay"}
        </Link>
      </p>
    </div>
  );
}
