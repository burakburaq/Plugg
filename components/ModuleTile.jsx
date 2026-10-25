import Button from "./Button.jsx";

export default function ModuleTile({ id, title, description, icon, onSelect, running = false, className = "", ...props }) {
  return <Button variant="control" id={`open-${id}`} data-module-id={id} className={`page-link ${className}`.trim()} title={`${description}${running ? " · Arka planda çalışıyor" : ""}`} onClick={onSelect} {...props}>
    {running && <span className="module-running" role="img" aria-label="Arka planda çalışıyor" />}
    <svg className="page-symbol" viewBox="0 0 24 24" fill="none" aria-hidden="true">{icon}</svg>
    <span className="page-label">{title}</span>
  </Button>;
}
