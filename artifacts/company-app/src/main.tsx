import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

async function applyDynamicFavicon() {
  try {
    const res = await fetch(`${API_BASE}/api/settings/public`);
    if (!res.ok) return;
    const { logoUrl, name } = await res.json();

    if (name) {
      document.title = name + " Portal";
    }

    if (logoUrl) {
      // Point the favicon directly to our /api/settings/favicon endpoint
      // which serves the image with the correct Content-Type (works for both
      // same-origin dev and cross-origin Render deployments)
      const existing = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      const link = existing ?? document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      link.href = `${API_BASE}/api/settings/favicon`;
      if (!existing) document.head.appendChild(link);
      // Force browser to reload the favicon
      link.href = `${API_BASE}/api/settings/favicon?t=${Date.now()}`;
    }
  } catch {
    // Keep default favicon if fetch fails
  }
}

applyDynamicFavicon();

createRoot(document.getElementById("root")!).render(<App />);
