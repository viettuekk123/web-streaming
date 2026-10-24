import { useState, type FormEvent } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { errorMessage } from "./api/client";
import { HomePage } from "./pages/HomePage";
import { WatchPage } from "./pages/WatchPage";
import { AuthPage } from "./pages/AuthPage";
import { UploadPage } from "./pages/UploadPage";
import { MyVideosPage } from "./pages/MyVideosPage";

function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") || "").trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }
  return (
    <>
      <header className="header">
        <Link to="/" className="brand">
          <span className="brand-icon">▶</span>BVG
          <span className="brand-sub">stream</span>
        </Link>
        <form className="search" onSubmit={search}>
          <input
            name="q"
            aria-label="Tìm kiếm video"
            placeholder="Tìm video bạn muốn xem…"
          />
          <button aria-label="Tìm kiếm">⌕</button>
        </form>
        <div className="header-actions">
          <Link className="upload-link" to="/upload">
            ＋ Upload
          </Link>
          {user ? (
            <>
              <span className="username">{user.username}</span>
              <button
                onClick={() => {
                  void logout().catch((e) => setError(errorMessage(e)));
                }}
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <Link className="login-link" to="/login">
              Đăng nhập
            </Link>
          )}
        </div>
      </header>
      <nav className="sidebar">
        <small>KHÔNG GIAN CỦA BẠN</small>
        <NavLink to="/" end>
          <span>⌂</span>Khám phá
        </NavLink>
        <NavLink to="/mine">
          <span>▣</span>Video của tôi
        </NavLink>
        <NavLink to="/upload">
          <span>＋</span>Upload video
        </NavLink>
        <div className="nav-divider" />
        <small>HỌC CÙNG BVG</small>
        <NavLink to="/demo">
          <span>◈</span>ABR Lab
        </NavLink>
        <div className="sidebar-note">
          <span className="status-dot" /> BUILT TO LEARN
          <p>Mỗi segment, một điều mới.</p>
        </div>
      </nav>
      <main className="content">
        {error && <p className="error">{error}</p>}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/demo" element={<WatchPage demo />} />
          <Route path="/demo/:id" element={<WatchPage demo />} />
          <Route path="/login" element={<AuthPage key="login" />} />
          <Route
            path="/register"
            element={<AuthPage key="register" register />}
          />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/mine" element={<MyVideosPage />} />
          <Route
            path="*"
            element={
              <div className="empty">
                Không tìm thấy trang. <Link to="/">Về trang chủ</Link>
              </div>
            }
          />
        </Routes>
      </main>
    </>
  );
}
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout />
      </AuthProvider>
    </BrowserRouter>
  );
}
