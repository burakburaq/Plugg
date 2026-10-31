import { t } from "../../../modules/i18n.js";
import { useState } from "react";
import Button from "../../Button.jsx";
export default function FullPageCapture() {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function capture() {
    const permission = chrome.permissions.request({ permissions: ["debugger", "downloads"] });
    setBusy(true); setMessage("");
    try {
      if (!await permission) throw new Error(t("common_screenshot_permission_was_not_granted"));
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.runtime.sendMessage({ target: "page-tools-background", type: "capture:full", tabId: tab?.id });
      if (!response?.ok) throw new Error(response?.error || t("page_capture_could_not_capture_page"));
      setMessage(t("page_capture_value1_value2_downloading_png", response.state.width, response.state.height));
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <section id="capture-view" className="tool-content">
    <Button id="capture-full-page" variant="primary" disabled={busy} onClick={capture}>{busy ? t("page_capture_capturing") : t("page_capture_download_full_page_as_png")}</Button>
    <p className="muted">{"" + t("page_capture_entire_page_is_downloaded_as_one_png") + ""}</p>
    {message && <p role="status" className="tool-description">{message}</p>}
  </section>;
}
