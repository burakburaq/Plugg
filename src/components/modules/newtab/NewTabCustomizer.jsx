import { t } from "../../../modules/i18n.js";
import { useState } from "react";
import Button from "../../Button.jsx";

export default function NewTabCustomizer() {
  const [error, setError] = useState("");
  async function open() {
    try { await chrome.tabs.create({ url: chrome.runtime.getURL("src/components/modules/newtab/newtab.html") }); }
    catch { setError(t("new_tab_could_not_open_new_tab")); }
  }
  return <section id="newtab-view" className="tool-content">
    <Button id="open-newtab" variant="primary" onClick={open}>{"" + t("new_tab_open_new_tab") + ""}</Button>
    <p className="muted">{"" + t("new_tab_use_gear_on_new_tab_to_add") + ""}</p>
    <p className="muted">{"" + t("new_tab_new_tabs_are_customized_while_this_module") + ""}</p>
    {error && <p className="tool-error" role="alert">{error}</p>}
  </section>;
}
