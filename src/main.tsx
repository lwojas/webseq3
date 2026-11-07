import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Shell } from "./ui/Shell";
import "./index.css";
import { mountPerfOverlay } from "./debug/perfOverlay";

mountPerfOverlay();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {new URLSearchParams(location.search).get("ui") === "2" ? <Shell /> : <App />}
  </StrictMode>,
);
