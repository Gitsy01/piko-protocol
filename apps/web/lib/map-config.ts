const FALLBACK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const FALLBACK_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const DEFAULT_MAPTILER_STYLE = "streets-v2";
const mapTilerKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim();
const configuredStyle = process.env.NEXT_PUBLIC_MAPTILER_STYLE?.trim() || DEFAULT_MAPTILER_STYLE;

function buildMapTilerUrl(style: string, key: string) {
  const normalizedStyle = style.replace(/^\/+|\/+$/g, "") || DEFAULT_MAPTILER_STYLE;
  return `https://api.maptiler.com/maps/${encodeURIComponent(normalizedStyle)}/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}`;
}

export const mapTiles = mapTilerKey ? buildMapTilerUrl(configuredStyle, mapTilerKey) : FALLBACK_TILES;

export const mapAttribution = mapTilerKey
  ? '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  : FALLBACK_ATTRIBUTION;

export const isMapTilerEnabled = Boolean(mapTilerKey);
export const mapStyleName = configuredStyle;
