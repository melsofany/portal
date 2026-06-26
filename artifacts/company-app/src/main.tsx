import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

async function applyDynamicFavicon() {
  try {
    const res = await fetch("/api/settings/public");
    if (!res.ok) return;
    const { logoUrl, name } = await res.json();

    if (name) {
      document.title = name + " Portal";
    }

    if (logoUrl && logoUrl.startsWith("http")) {
      const link =
        (document.querySelector("link[rel~='icon']") as HTMLLinkElement) ||
        document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      link.href = logoUrl;
      document.head.appendChild(link);
    }
  } catch {
    // Keep default favicon if fetch fails
  }
}

applyDynamicFavicon();

createRoot(document.getElementById("root")!).render(<App />);
