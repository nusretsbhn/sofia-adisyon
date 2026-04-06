import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import Cariler from "./pages/Cariler.jsx";
import CariDetay from "./pages/CariDetay.jsx";
import Kategoriler from "./pages/Kategoriler.jsx";
import CanliAdisyonlar from "./pages/CanliAdisyonlar.jsx";
import Urunler from "./pages/Urunler.jsx";
import Hammaddeler from "./pages/Hammaddeler.jsx";
import Ayarlar from "./pages/Ayarlar.jsx";
import Raporlar from "./pages/Raporlar.jsx";
import Envanter from "./pages/Envanter.jsx";
import Receteler from "./pages/Receteler.jsx";
import Kullanicilar from "./pages/Kullanicilar.jsx";

function RequireAuth({ children }) {
  const loc = useLocation();
  const token = localStorage.getItem("turadisyon_token");
  if (!token) {
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }
  return children;
}

/** Garson rolü rapor / envanter / reçete sayfalarına girmesin (API zaten 403). */
function BlockGarson({ children }) {
  try {
    const u = JSON.parse(localStorage.getItem("turadisyon_user") || "null");
    if (u?.rol === "GARSON") {
      return <Navigate to="/" replace />;
    }
  } catch {
    return <Navigate to="/" replace />;
  }
  return children;
}

/** Yalnızca Admin rolü (Ayarlar, Kullanıcılar vb.) */
function BlockNonAdmin({ children }) {
  try {
    const u = JSON.parse(localStorage.getItem("turadisyon_user") || "null");
    if (u?.rol !== "ADMIN") {
      return <Navigate to="/" replace />;
    }
  } catch {
    return <Navigate to="/" replace />;
  }
  return children;
}

function Layout({ children }) {
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("turadisyon_user") || "null");
    } catch {
      return null;
    }
  })();

  function logout() {
    localStorage.removeItem("turadisyon_token");
    localStorage.removeItem("turadisyon_user");
    window.location.href = "/admin/login";
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r border-slate-700 bg-slate-950 p-4">
        <div className="text-lg font-bold text-blue-400 mb-6">TurAdisyon</div>
        <nav className="flex flex-col gap-2 text-sm">
          <Link className="text-slate-300 hover:text-white" to="/">
            Ana sayfa
          </Link>
          {storedUser?.rol !== "GARSON" && (
            <Link className="text-slate-300 hover:text-white" to="/raporlar">
              Raporlar
            </Link>
          )}
          <Link className="text-slate-300 hover:text-white" to="/cariler">
            Cariler
          </Link>
          <Link className="text-slate-300 hover:text-white" to="/kategoriler">
            Kategoriler
          </Link>
          <Link className="text-slate-300 hover:text-white" to="/canli-adisyonlar">
            Canlı adisyonlar
          </Link>
          <Link className="text-slate-300 hover:text-white" to="/urunler">
            Ürünler
          </Link>
          {storedUser?.rol !== "GARSON" && (
            <Link className="text-slate-300 hover:text-white" to="/hammadde">
              Hammadde
            </Link>
          )}
          {storedUser?.rol !== "GARSON" && (
            <>
              <Link className="text-slate-300 hover:text-white" to="/envanter">
                Envanter
              </Link>
              <Link className="text-slate-300 hover:text-white" to="/receteler">
                Reçeteler
              </Link>
            </>
          )}
          {storedUser?.rol === "ADMIN" && (
            <>
              <Link className="text-slate-300 hover:text-white" to="/kullanicilar">
                Kullanıcılar
              </Link>
              <Link className="text-slate-300 hover:text-white" to="/ayarlar">
                Ayarlar
              </Link>
            </>
          )}
        </nav>
        <button
          type="button"
          onClick={logout}
          className="mt-8 text-left text-sm text-slate-500 hover:text-slate-300"
        >
          Çıkış
        </button>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout>
              <Dashboard />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/cariler"
        element={
          <RequireAuth>
            <Layout>
              <Cariler />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/cariler/:id"
        element={
          <RequireAuth>
            <Layout>
              <CariDetay />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/kategoriler"
        element={
          <RequireAuth>
            <Layout>
              <Kategoriler />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/canli-adisyonlar"
        element={
          <RequireAuth>
            <Layout>
              <CanliAdisyonlar />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/urunler"
        element={
          <RequireAuth>
            <Layout>
              <Urunler />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/hammadde"
        element={
          <RequireAuth>
            <BlockGarson>
              <Layout>
                <Hammaddeler />
              </Layout>
            </BlockGarson>
          </RequireAuth>
        }
      />
      <Route
        path="/kullanicilar"
        element={
          <RequireAuth>
            <BlockNonAdmin>
              <Layout>
                <Kullanicilar />
              </Layout>
            </BlockNonAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/ayarlar"
        element={
          <RequireAuth>
            <BlockNonAdmin>
              <Layout>
                <Ayarlar />
              </Layout>
            </BlockNonAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/raporlar"
        element={
          <RequireAuth>
            <BlockGarson>
              <Layout>
                <Raporlar />
              </Layout>
            </BlockGarson>
          </RequireAuth>
        }
      />
      <Route
        path="/envanter"
        element={
          <RequireAuth>
            <BlockGarson>
              <Layout>
                <Envanter />
              </Layout>
            </BlockGarson>
          </RequireAuth>
        }
      />
      <Route
        path="/receteler"
        element={
          <RequireAuth>
            <BlockGarson>
              <Layout>
                <Receteler />
              </Layout>
            </BlockGarson>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
