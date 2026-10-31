import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { loadPluggFont } from "../../modules/ui-font.js";
import { uiLocale } from "../../modules/i18n.js";
import { startPopupGlow } from "./popupGlow.js";
import "./styles.css";

document.documentElement.lang = /^tr(?:[-_]|$)/i.test(uiLocale()) ? "tr" : "en";
startPopupGlow();
loadPluggFont().finally(() => {
  createRoot(document.getElementById("root")).render(<App />);
});
