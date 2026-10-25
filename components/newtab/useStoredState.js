import { useEffect, useRef, useState } from "react";

export default function useStoredState(key, normalize) {
  const [value, setValue] = useState(() => normalize());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(value);
  const writes = useRef(Promise.resolve());
  const pending = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const apply = raw => { const next = normalize(raw); current.current = next; setValue(next); };
    const listener = (changes, area) => { if (area === "local" && changes[key] && !pending.current) apply(changes[key].newValue); };
    chrome.storage.onChanged.addListener(listener);
    chrome.storage.local.get(key).then(saved => { if (mounted.current) { apply(saved[key]); setReady(true); } }).catch(() => { if (mounted.current) setError("Kayıtlar okunamadı. Sayfayı yenile."); });
    return () => { mounted.current = false; chrome.storage.onChanged.removeListener(listener); };
  }, [key, normalize]);
  function update(change) {
    if (!ready) return;
    const next = normalize(typeof change === "function" ? change(current.current) : change);
    current.current = next; setValue(next); setError("");
    pending.current++;
    writes.current = writes.current.catch(() => {}).then(() => chrome.storage.local.set({ [key]: next })).catch(() => { if (mounted.current) setError("Değişiklik kaydedilemedi."); }).finally(() => pending.current--);
  }
  return [value, update, ready, error];
}
