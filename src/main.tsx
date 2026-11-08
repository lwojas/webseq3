import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Shell } from "./ui/Shell";
import "./index.css";
import { mountPerfOverlay } from "./debug/perfOverlay";

mountPerfOverlay();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
