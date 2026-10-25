const paths = {
  search: "m21 21-5-5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z",
  settings: "m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 2 3-2 1-3 3-1 1-3-2-2 1-3-3-2-3 1-2-2Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  close: "m6 6 12 12M6 18 18 6", plus: "M12 5v14M5 12h14", check: "m5 12 4 4 10-10",
  filter: "M3 6h2m4 0h12M3 12h10m4 0h4M3 18h5m4 0h9M7 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-5 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z", clock: "M12 8v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
  todo: "M9 6h11M9 12h11M9 18h11M3 5l1 1 2-2M3 11l1 1 2-2M3 17l1 1 2-2",
  note: "M5 3h14v18H5V3Zm3 5h8M8 12h8M8 16h5", chevron: "m9 6 6 6-6 6",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z", info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 11v6m0-10v.01", arrow: "M4 12h16m-6-6 6 6-6 6",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M2 12h2M20 12h2m-15-7 1 1m12 12 1 1M5 19l1-1M18 6l1-1",
  cloud: "M6 18h13a4 4 0 0 0 0-8 6 6 0 0 0-11-1 4.5 4.5 0 0 0-2 9Z",
  play: "m9 5 11 7-11 7V5Z", pause: "M8 5v14M16 5v14", reset: "M4 9a8 8 0 1 1 0 6M4 3v6h6",
  link: "m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m4 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0",
  resize: "M10 20h10V10m0 10L10 10", drag: "M8 4h.01M16 4h.01M8 12h.01M16 12h.01M8 20h.01M16 20h.01"
};
export default function Icon({ name, ...props }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.link} /></svg>;
}
