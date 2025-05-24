import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { IconContext } from "react-icons";
import { ClerkProvider } from "@clerk/clerk-react";

// Import your publishable key from environment variables
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
    <IconContext.Provider value={{ className: "react-icons" }}>
      <App />
    </IconContext.Provider>
  </ClerkProvider>
);
