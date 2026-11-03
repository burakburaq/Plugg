import { useState } from "react";
import Button from "../../Button.jsx";
import { t } from "../../../modules/i18n.js";
import ColorPickerCopy from "./ColorPickerCopy.jsx";
import FontFinderCopy from "./FontFinderCopy.jsx";

export default function WhatsThis() {
  const [mode, setMode] = useState(null);
  function selectMode(next) { setMode(next); }
  return <>
    <div className="tool-content"><div className="button-row">
      <Button variant={mode === "font" ? "primary" : "secondary"} onClick={() => selectMode("font")} aria-pressed={mode === "font"}>{t("modules_font_finder")}</Button>
      <Button variant={mode === "color" ? "primary" : "secondary"} onClick={() => selectMode("color")} aria-pressed={mode === "color"}>{t("modules_color_picker")}</Button>
    </div></div>
    {mode === "font" && <FontFinderCopy />}
    {mode === "color" && <ColorPickerCopy />}
  </>;
}
