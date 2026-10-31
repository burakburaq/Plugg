import { t, uiLocale } from "../../../../modules/i18n.js";
import { useEffect, useState } from "react";
export default function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(id); }, []);
  const hour = now.getHours();
  const greeting = hour < 6 ? t("clock_good_night") : hour < 12 ? t("clock_good_morning") : hour < 18 ? t("clock_good_afternoon") : t("clock_good_evening");
  return <div className="nt-clock"><time>{now.toLocaleTimeString(uiLocale(), { hour: "2-digit", minute: "2-digit" })}</time><p>{greeting}</p></div>;
}
