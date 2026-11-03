import { t } from "../../../modules/i18n.js";
import { useState } from "react";
import Button from "../../Button.jsx";
export default function DomainGroups() {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function group() {
    const permission = chrome.permissions.request({ permissions: ["tabs", "tabGroups"] });
    setBusy(true); setMessage("");
    try {
      if (!await permission) throw new Error(t("tab_groups_tab_grouping_permission_was_not_granted"));
      const response = await chrome.runtime.sendMessage({ target: "page-tools-background", type: "groups:domain" });
      if (!response?.ok) throw new Error(response?.error || t("tab_groups_could_not_group_tabs"));
      setMessage(response.state.groups ? t("tab_groups_grouped_value1_tabs_into_value2_domains", response.state.tabs, response.state.groups) : t("tab_groups_there_are_no_multiple_tabs_on_same"));
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <section id="groups-view" className="tool-content">
    <Button id="group-domain-tabs" variant="primary" disabled={busy} onClick={group}>{busy ? t("tab_groups_grouping") : t("tab_groups_group_by_domain")}</Button>
    <p className="muted">{"" + t("tab_groups_tabs_in_this_window_are_grouped_by") + ""}</p>
    {message && <p className="tool-description" role="status">{message}</p>}
  </section>;
}
