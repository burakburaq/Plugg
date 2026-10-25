import { useEffect, useState } from "react";
export default function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(id); }, []);
  const hour = now.getHours();
  const greeting = hour < 6 ? "İyi geceler" : hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";
  return <div className="nt-clock"><time>{now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</time><p>{greeting}</p></div>;
}
