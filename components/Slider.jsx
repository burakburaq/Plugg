export default function Slider({ value, onChange, vertical = false, ...props }) {
  return <input type="range" className={vertical ? "slider-vertical" : "slider-horizontal"}
    aria-orientation={vertical ? "vertical" : "horizontal"} value={value}
    onChange={event => onChange(Number(event.target.value))} {...props} />;
}
