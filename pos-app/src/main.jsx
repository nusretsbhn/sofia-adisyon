import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

// Electron production: sayfa file:// ile açılır; BrowserRouter History API bu ortamda kırılır → boş ekran.
// HashRouter (/#/...) file:// + Vite dev ile uyumludur.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
