export default function Button({ variant = "text", className = "", children, ...props }) {
  return <button type="button" className={`shared-button ${variant}-button ${className}`.trim()} {...props}>{children}</button>;
}
