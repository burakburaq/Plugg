import { t } from "../../../modules/i18n.js";
import { useState } from "react";
import Button from "../../Button.jsx";

export default function QrCreator({ draft, onDraftChange }) {
  const [error, setError] = useState("");
  const update = patch => onDraftChange(current => ({ ...current, ...patch }));
  async function useCurrentTab() {
    setError("");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) throw new Error();
      update({ type: "url", text: tab.url.slice(0, 2000) });
    } catch { setError(t("qr_creator_could_not_get_current_page_url")); }
  }
  return <section id="qr-view" className="tool-content">
    <div className="module-toolbar"><span className="view-badge">{"" + t("qr_creator_design") + ""}</span></div>
    <div className="field"><label htmlFor="qr-type">{"" + t("qr_creator_content_type") + ""}</label><select id="qr-type" value={draft.type} onChange={event => update({ type: event.target.value })}><option value="url">{"" + t("common_link") + ""}</option><option value="text">{"" + t("qr_creator_text") + ""}</option></select></div>
    <div className="field"><div className="field-heading"><label htmlFor="qr-text">{"" + t("qr_creator_content") + ""}</label><Button id="qr-current-tab" onClick={useCurrentTab}>{"" + t("qr_creator_use_current_page") + ""}</Button></div>
      <textarea id="qr-text" rows="3" maxLength="2000" value={draft.text} placeholder={draft.type === "url" ? "https://ornek.com" : t("qr_creator_enter_qr_content")} onChange={event => update({ text: event.target.value })} />
      <span id="qr-count" className="muted">{draft.text.length} / 2000</span>
    </div>
    <div className="field-grid">
      <div className="field"><label htmlFor="qr-size">{"" + t("qr_creator_size") + ""}</label><select id="qr-size" value={draft.size} onChange={event => update({ size: event.target.value })}><option>256 × 256</option><option>512 × 512</option><option>1024 × 1024</option></select></div>
      <div className="field"><label htmlFor="qr-correction">{"" + t("qr_creator_error_correction") + ""}</label><select id="qr-correction" value={draft.correction} onChange={event => update({ correction: event.target.value })}><option value="L">{"" + t("qr_creator_low") + ""}</option><option value="M">{"" + t("qr_creator_medium") + ""}</option><option value="Q">{"" + t("qr_creator_high") + ""}</option><option value="H">{"" + t("qr_creator_highest") + ""}</option></select></div>
    </div>
    <div className="field-grid">
      <div className="color-field"><label htmlFor="qr-foreground">{"" + t("qr_creator_qr_color") + ""}</label><input id="qr-foreground" type="color" value={draft.foreground} onChange={event => update({ foreground: event.target.value })} /></div>
      <div className="color-field"><label htmlFor="qr-background">{"" + t("common_background") + ""}</label><input id="qr-background" type="color" value={draft.background} onChange={event => update({ background: event.target.value })} /></div>
    </div>
    <div className="qr-preview" aria-label={t("qr_creator_qr_preview_area")}><span aria-hidden="true">▦</span><p>{"" + t("qr_creator_qr_preview_will_appear_here") + ""}</p></div>
    <p className="muted">{"" + t("qr_creator_qr_generation_is_not_available_yet") + ""}</p>
    <div className="button-row"><Button variant="primary" disabled>{"" + t("qr_creator_create_qr") + ""}</Button><Button variant="secondary" disabled>{"" + t("common_download_png") + ""}</Button></div>
    {error && <p id="qr-error" className="tool-error" role="alert">{error}</p>}
  </section>;
}
