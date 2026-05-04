import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

function socketOrigin() {
  const o = import.meta.env.VITE_SOCKET_ORIGIN?.trim();
  if (o) return o.replace(/\/$/, "");
  const base = import.meta.env.VITE_API_BASE?.trim();
  if (base) return base.replace(/\/$/, "");
  if (
    typeof window !== "undefined" &&
    window.location?.origin &&
    window.location.protocol !== "file:"
  ) {
    return window.location.origin;
  }
  return "http://127.0.0.1:3000";
}

function localBackendUrl() {
  return (import.meta.env.VITE_LOCAL_BACKEND_URL || "http://127.0.0.1:3000").replace(
    /\/$/,
    "",
  );
}

/**
 * Uzak sunucudan `catalog:refresh` dinler; yerel senkron açıksa SQLite’ı çeker, ardından
 * tüm ekranlar `turadisyon:catalog-refresh` ile listeyi yenileyebilir.
 */
export function CatalogSocketBridge() {
  const [katalogUyari, setKatalogUyari] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("turadisyon_pos_token");
    if (!token) return;

    const origin = socketOrigin();
    const s = io(origin, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
    });
    socketRef.current = s;

    async function onCatalogRefresh() {
      const t = localStorage.getItem("turadisyon_pos_token");
      if (!t) return;
      try {
        const localBase = localBackendUrl();
        await fetch(`${localBase}/api/sync/pull-master`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${t}`,
            "Content-Type": "application/json",
          },
        });
      } catch {
        /* Yerel backend yok veya uzak-only POS — sorun değil */
      }
      window.dispatchEvent(new CustomEvent("turadisyon:catalog-refresh"));
      setKatalogUyari(true);
    }

    s.on("catalog:refresh", onCatalogRefresh);

    return () => {
      s.off("catalog:refresh", onCatalogRefresh);
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  if (!katalogUyari) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="katalog-uyari-baslik"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-600 bg-slate-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="katalog-uyari-baslik"
          className="text-center text-base text-slate-100"
        >
          Ürün listesi güncellendi.
        </p>
        <button
          type="button"
          onClick={() => setKatalogUyari(false)}
          className="mt-6 w-full rounded-lg border border-slate-500 bg-slate-800 py-3 text-sm font-medium text-slate-100 hover:bg-slate-700"
        >
          Tamam
        </button>
      </div>
    </div>
  );
}
