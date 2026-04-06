import axios from "axios";

const rawBase = import.meta.env.VITE_API_BASE?.trim() ?? "";
const apiBase = rawBase.replace(/\/+$/, "");

if (!import.meta.env.DEV && !apiBase) {
  throw new Error(
    "VITE_API_BASE zorunlu. Admin production build'i VPS API adresine yönlendirilmelidir.",
  );
}

const api = axios.create({
  baseURL: apiBase,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const t = localStorage.getItem("turadisyon_token");
  if (t) {
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

export default api;
export { apiBase };
