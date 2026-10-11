import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { WorkspaceProvider } from "./app/WorkspaceContext";
import "./styles.css";
import { LearningProvider } from "./app/LearningContext";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <WorkspaceProvider>
        <LearningProvider>
          <App />
        </LearningProvider>
      </WorkspaceProvider>
    </BrowserRouter>
  </StrictMode>,
);
