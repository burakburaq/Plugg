export default function WeatherSymbol({ code = 2 }) {
  const sun = code <= 3, cloud = code !== 0;
  return <svg className="nt-weather-symbol" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    {sun && <g stroke="#edb72b" strokeWidth="1.5" strokeLinecap="round"><circle cx={cloud ? 30 : 24} cy={cloud ? 17 : 24} r="8" fill="#f7c438" stroke="none" />{cloud ? <path d="M30 4v2m0 22v2M17 17h2m22 0h2M21 8l2 2m14 14 2 2M21 26l2-2M37 10l2-2" /> : <path d="M24 9v2m0 26v2M9 24h2m26 0h2M13 13l2 2m18 18 2 2M13 35l2-2M33 15l2-2" />}</g>}
    {cloud && <path d="M13 36h20a7 7 0 0 0 0-14 10 10 0 0 0-19-2 8 8 0 0 0-1 16Z" fill="#fff" />}
    {code >= 51 && code <= 82 && <path d="m16 40-1 3m9-3-1 3m9-3-1 3" stroke="#729fca" strokeWidth="2" strokeLinecap="round" />}
  </svg>;
}
