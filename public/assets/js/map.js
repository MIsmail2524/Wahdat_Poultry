// Animated trade-route map (equirectangular, cropped). Renders into any [data-map] element.
const W = 1000, LON0 = -80, LON1 = 125, LAT0 = 56, LAT1 = -8;
const H = Math.round(W * (LAT0 - LAT1) / (LON1 - LON0));
const px = (lon, lat) => [((lon - LON0) / (LON1 - LON0)) * W, ((LAT0 - lat) / (LAT0 - LAT1)) * H];

const HUB = { name: 'Karachi Port', lon: 67.0, lat: 24.85 };
// kind: 'current' = destinations of Pakistani egg exports FY2024-25 (Profit, 2025); 'target' = priority GCC markets
export const MARKETS = [
  { name: 'UAE · Jebel Ali', lon: 55.03, lat: 25.0, kind: 'current', dx: -8, dy: 26, anchor: 'end' },
  { name: 'Bahrain', lon: 50.58, lat: 26.2, kind: 'current', dx: -10, dy: -2, anchor: 'end' },
  { name: 'Kuwait', lon: 47.98, lat: 29.37, kind: 'current', dx: -10, dy: -6, anchor: 'end' },
  { name: 'Qatar · Hamad', lon: 51.6, lat: 25.0, kind: 'target', dx: -12, dy: 14, anchor: 'end' },
  { name: 'Oman · Sohar', lon: 56.7, lat: 24.35, kind: 'target', dx: 4, dy: 30, anchor: 'start' },
  { name: 'Saudi · Jeddah', lon: 39.17, lat: 21.5, kind: 'target', dx: -10, dy: 4, anchor: 'end' },
  { name: 'Somalia', lon: 45.34, lat: 2.04, kind: 'current', dx: -10, dy: 4, anchor: 'end' },
  { name: 'Hong Kong', lon: 114.17, lat: 22.3, kind: 'current', dx: 0, dy: -14, anchor: 'middle' },
  { name: 'United States', lon: -74.0, lat: 40.7, kind: 'current', dx: 10, dy: -12, anchor: 'start' },
];

export function renderMap(el) {
  const [hx, hy] = px(HUB.lon, HUB.lat);
  let dots = '';
  for (let x = 6; x < W; x += 14) for (let y = 6; y < H; y += 14) {
    const o = 0.05 + 0.1 * Math.max(0, 1 - Math.hypot(x - hx, y - hy) / 600);
    dots += `<circle cx="${x}" cy="${y}" r="1.3" fill="#fbf6ec" opacity="${o.toFixed(3)}"/>`;
  }
  const routes = MARKETS.map((m, i) => {
    const [x, y] = px(m.lon, m.lat);
    const mx = (hx + x) / 2; const lift = Math.min(200, Math.abs(hx - x) * 0.32 + 26);
    const d = `M${hx.toFixed(1)},${hy.toFixed(1)} Q${mx.toFixed(1)},${(Math.min(hy, y) - lift).toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
    const target = m.kind === 'target';
    return `<path class="route-base" d="${d}"/>
      <path class="route" d="${d}" style="animation-delay:${-i * 0.4}s;${target ? 'stroke:#7fbf6a' : ''}"/>
      <circle class="pulse" cx="${x}" cy="${y}" r="6" style="animation-delay:${i * 0.25}s;${target ? 'stroke:#7fbf6a' : ''}"/>
      <circle class="dot" cx="${x}" cy="${y}" r="4" ${target ? 'fill="#7fbf6a"' : ''}/>
      <text x="${x + m.dx}" y="${y + m.dy}" text-anchor="${m.anchor}">${m.name}</text>`;
  }).join('');
  el.innerHTML = `<svg class="map-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Export routes from Karachi to Gulf, Asian, African and US markets">
    <g>${dots}</g>${routes}
    <circle class="pulse" cx="${hx}" cy="${hy}" r="9"/><circle class="hub" cx="${hx}" cy="${hy}" r="7"/>
    <text x="${hx + 14}" y="${hy + 5}" style="font-weight:800;fill:#f6b40e">${HUB.name}</text>
    <g transform="translate(${W - 250},${H - 52})" style="font-size:12px">
      <circle cx="6" cy="0" r="5" fill="#fbf6ec"/><text x="18" y="4">Current PK egg export markets</text>
      <circle cx="6" cy="22" r="5" fill="#7fbf6a"/><text x="18" y="26">Priority GCC growth markets</text>
    </g></svg>`;
}

document.querySelectorAll('[data-map]').forEach(renderMap);
