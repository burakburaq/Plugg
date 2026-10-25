export default function Button({ variant = "text", className = "", children, ...props }) {
  return <button type="button" className={`${variant}-button ${className}`.trim()} {...props}>{children}</button>;
}
