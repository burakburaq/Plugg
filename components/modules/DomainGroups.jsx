import { useState } from "react";
import Button from "../Button.jsx";
export default function DomainGroups() {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function group() {
    const permission = chrome.permissions.request({ permissions: ["tabs", "tabGroups"] });
    setBusy(true); setMessage("");
    try {
      if (!await permission) throw new Error("Sekme gruplama izni verilmedi.");
      const response = await chrome.runtime.sendMessage({ target: "page-tools-background", type: "groups:domain" });
      if (!response?.ok) throw new Error(response?.error || "Sekmeler gruplanamadı.");
      setMessage(response.state.groups ? `${response.state.tabs} sekme, ${response.state.groups} domain grubuna alındı.` : "Aynı domaine ait birden fazla sekme yok.");
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <section id="groups-view" className="tool-content">
    <Button id="group-domain-tabs" variant="primary" disabled={busy} onClick={group}>{busy ? "Gruplanıyor…" : "Domain'e göre grupla"}</Button>
    <p className="muted">Bu pencerede aynı domaine ait sekmeler birlikte gruplanır. Sabitlenmiş sekmeler yerinde kalır.</p>
    {message && <p className="tool-description" role="status">{message}</p>}
  </section>;
}
