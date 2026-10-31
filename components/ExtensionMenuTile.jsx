import { useEffect, useRef, useState } from "react";
import { t } from "../modules/i18n.js";
import Button from "./Button.jsx";
import { resolveTileVariant } from "./menuThemes.js";

export function hashModuleTitle(title) {
  let hash = 2166136261;
  for (const character of title.normalize("NFC")) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  return hash >>> 0;
}

export default function ExtensionMenuTile({ id, title, description, icon, picture, variant = "icon", allowPictures = false, colorFromTitle = false, theme, hue, onSelect, running = false, className = "", style, ...props }) {
  const labelRef = useRef(null);
  const [labelFontSize, setLabelFontSize] = useState(null);
  const [failedPicture, setFailedPicture] = useState(null);
  const tileVariant = resolveTileVariant(variant, allowPictures, Boolean(picture) && failedPicture !== picture);
  const isPicture = tileVariant === "picture" || tileVariant === "picture-tiny";
  const tileStyle = !isPicture && colorFromTitle ? { ...style, "--tile-hue": hue ?? hashModuleTitle(title) % 360 } : style;
  const words = title.trim().split(/\s+/);
  useEffect(() => {
    const label = labelRef.current;
    if (!label) return;
    let frame;
    const fitText = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const style = getComputedStyle(label);
        const available = label.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2;
        if (!available) return;
        const spans = [...label.querySelectorAll(":scope > span")];
        const lines = spans.length ? spans.map(span => span.textContent) : [label.textContent];
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        const tileHeight = label.parentElement.clientHeight;
        const maxSize = parseFloat(style.getPropertyValue("--card-text-max")) || 28;
        let size = Math.min(maxSize, (tileHeight - 14) / (lines.length * 1.15));
        while (size > 8) {
          context.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
          if (lines.every(line => context.measureText(line).width <= available)) break;
          size -= 0.5;
        }
        setLabelFontSize(size);
      });
    };
    const observer = new ResizeObserver(fitText);
    observer.observe(label);
    document.fonts?.ready.then(fitText);
    fitText();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [title, theme, isPicture]);
  return <Button variant="control" id={`open-${id}`} data-module-id={id} className={`page-link page-link--${tileVariant} ${className}`.trim()} style={tileStyle} aria-label={title} title={`${description}${running ? t("module_menu_running_in_background") : ""}`} onClick={onSelect} {...props}>
    {running && <span className="module-running" role="img" aria-label={t("module_menu_running_in_background_2")} />}
    {isPicture ? <img className="page-picture" src={picture} alt="" draggable={false} onError={() => setFailedPicture(picture)} /> : <>
      <svg className="page-symbol" viewBox="0 0 24 24" fill="none" aria-hidden="true">{icon}</svg>
      {words.length > 1 ? <span ref={labelRef} className="page-label page-label--split" style={labelFontSize ? { fontSize: `${labelFontSize}px` } : undefined}><span>{words.slice(0, -1).join(" ")}</span><span>{words.at(-1)}</span></span> : <span ref={labelRef} className="page-label" style={labelFontSize ? { fontSize: `${labelFontSize}px` } : undefined}>{title}</span>}
    </>}
  </Button>;
}
