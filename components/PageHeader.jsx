import { t } from "../modules/i18n.js";
import { useEffect, useRef } from "react";
import Button from "./Button.jsx";

export default function PageHeader({ title, titleId, onBack }) {
  const heading = useRef(null);
  useEffect(() => { heading.current.focus(); }, [title]);
  return <header className="page-header">
    <Button id="back-to-menu" variant="back" data-back onClick={onBack} aria-label={t("common_return_to_module_menu")}><span aria-hidden="true">↩</span></Button>
    <h1 id={titleId} ref={heading} tabIndex={-1}>{title}</h1>
  </header>;
}
