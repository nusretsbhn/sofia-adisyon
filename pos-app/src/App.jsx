import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./pages/Login.jsx";
import AdisyonList from "./pages/AdisyonList.jsx";
import AdisyonDetay from "./pages/AdisyonDetay.jsx";
import SiparisEkrani from "./pages/SiparisEkrani.jsx";
import Odeme from "./pages/Odeme.jsx";

function RequireAuth({ children }) {
  const loc = useLocation();
  const token = localStorage.getItem("turadisyon_pos_token");
  if (!token) {
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AdisyonList />
          </RequireAuth>
        }
      />
      <Route
        path="/adisyon/:id/siparis"
        element={
          <RequireAuth>
            <SiparisEkrani />
          </RequireAuth>
        }
      />
      <Route
        path="/adisyon/:id"
        element={
          <RequireAuth>
            <AdisyonDetay />
          </RequireAuth>
        }
      />
      <Route
        path="/adisyon/:id/odeme"
        element={
          <RequireAuth>
            <Odeme />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
