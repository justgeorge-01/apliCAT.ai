import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"

// Shared legacy modules – data and non-UI logic of the European market. They
// attach window globals as side effects: AdmiticaData, buildRoadmapStages,
// getEssayRequirements. Not used by the «Китай» screens, kept for the legacy
// pages that still compile behind their flags (spec §4).
import "../../data/programs.js"
import "../../src/roadmapData.js"
import "../../src/essayReqs.js"

import { FEATURES } from "./lib/features"
import App from "./App"

// The AI client (`window.ai`, external endpoints + key) and the document
// export helpers (`download*`, CDN libs) serve only the AI screens. They are
// loaded on demand behind FEATURES.ai, so the storefront build never calls
// outside – the only outbound links are university pages and the partner's
// Telegram (spec invariants).
if (FEATURES.ai) {
  void import("../../src/ai.js")
  void import("../../src/downloads.js")
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
