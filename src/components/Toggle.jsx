import Button from "./Button.jsx";

export default function Toggle({ checked, onChange, ...props }) {
  return <Button variant="control" className="toggle" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} {...props}>
    <span className="toggle-knob" aria-hidden="true" />
  </Button>;
}
