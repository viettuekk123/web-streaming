import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";

interface User {
  id: string;
  username: string;
}
interface AuthResult {
  user: User;
  csrf_token: string;
}
interface AuthState {
  user: User | null;
  loading: boolean;
  authenticate: (
    username: string,
    password: string,
    confirm?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  function apply(data: AuthResult) {
    api.defaults.headers.common["X-CSRF-Token"] = data.csrf_token;
    setUser(data.user);
  }
  useEffect(() => {
    api
      .get<AuthResult>("/api/auth/me")
      .then((r) => apply(r.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  async function authenticate(
    username: string,
    password: string,
    confirm?: string,
  ) {
    const response = await api.post<AuthResult>(
      confirm === undefined ? "/api/auth/login" : "/api/auth/register",
      { username, password, confirm_password: confirm },
    );
    apply(response.data);
  }
  async function logout() {
    await api.post("/api/auth/logout");
    delete api.defaults.headers.common["X-CSRF-Token"];
    setUser(null);
  }
  return (
    <AuthContext.Provider value={{ user, loading, authenticate, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext)!;
}
