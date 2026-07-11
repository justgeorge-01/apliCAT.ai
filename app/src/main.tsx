import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"

// Shared legacy modules – single source of data and non-UI logic for both the
// live site and this app. They attach window globals as side effects:
// AdmiticaData, buildRoadmapStages, getEssayRequirements, ai, download*.
import "../../data/programs.js"
import "../../src/roadmapData.js"
import "../../src/essayReqs.js"
import "../../src/ai.js"
import "../../src/downloads.js"

import App from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
