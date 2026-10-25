import { useEffect, useRef } from "react";
import Button from "./Button.jsx";

export default function PageHeader({ title, titleId, onBack }) {
  const heading = useRef(null);
  useEffect(() => { heading.current.focus(); }, [title]);
  return <header className="page-header">
    <Button id="back-to-menu" variant="back" data-back onClick={onBack} aria-label="Modül menüsüne dön"><span aria-hidden="true">↩</span></Button>
    <h1 id={titleId} ref={heading} tabIndex={-1}>{title}</h1>
  </header>;
}
