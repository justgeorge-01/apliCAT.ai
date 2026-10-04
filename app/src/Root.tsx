import { Suspense, lazy } from "react"

import GuideApp from "./guide/GuideApp"
import { FEATURES } from "./lib/features"

// The application shell (plan, questionnaire, cabinet) is its own chunk: the
// public guide never downloads it.
const App = lazy(() => import("./App"))

/** Which site this build is: the public guide by default, the app shell on request. */
export default function Root() {
  if (FEATURES.edition === "app" || FEATURES.market === "europe") {
    return (
      <Suspense fallback={null}>
        <App />
      </Suspense>
    )
  }
  return <GuideApp />
}
