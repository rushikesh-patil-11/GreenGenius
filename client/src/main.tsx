import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { IconContext } from "react-icons";

createRoot(document.getElementById("root")!).render(
  <IconContext.Provider value={{ className: "react-icons" }}>
    <App />
  </IconContext.Provider>
);
