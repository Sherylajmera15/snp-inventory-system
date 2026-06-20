import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token =
      localStorage.getItem("snp_token") ?? sessionStorage.getItem("snp_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const onAuthPage =
      typeof window !== "undefined" &&
      ["/login", "/register", "/setup"].some((p) =>
        window.location.pathname.startsWith(p)
      );
    if (err.response?.status === 401 && !onAuthPage) {
      localStorage.removeItem("snp_token");
      localStorage.removeItem("snp_user");
      sessionStorage.removeItem("snp_token");
      sessionStorage.removeItem("snp_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
