import axios from "axios";

const baseURL =
  import.meta.env.VITE_API_BASE ??
  (import.meta.env.DEV ? "" : "http://127.0.0.1:3000");

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const t = localStorage.getItem("turadisyon_pos_token");
  if (t) {
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

export default api;
