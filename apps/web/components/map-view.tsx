"use client";

import {
  circle,
  DivIcon,
  LatLngExpression,
  layerGroup,
  Map as LeafletMap,
  marker,
  polyline,
  tileLayer,
  type LayerGroup,
} from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { mapAttribution, mapTiles } from "@/lib/map-config";
import { HeatmapNode, MerchantPinType } from "@/lib/types";
import { classifyPin, formatDistance, formatReward } from "@/lib/utils";

const PIN_GLYPHS: Record<string, string> = {
  FIRE: "F",
  STAR: "*",
  BOLT: "+",
  DOT: ".",
};

function animationDelayFromId(id: string) {
  return ((id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 8) * 0.18).toFixed(2);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildMerchantIcon(merchant: MerchantPinType, selected: boolean) {
  const pin = classifyPin(merchant.rewardMultiplier, merchant.isSponsored, merchant.isTrending);
  const glyph = PIN_GLYPHS[pin.emoji] ?? PIN_GLYPHS.DOT;

  return new DivIcon({
    className: "",
    html: `
      <button class="mapPin ${pin.tone} ${selected ? "selected" : ""}" style="animation-delay:${animationDelayFromId(merchant.id)}s" type="button">
        <span class="mapPinGlow"></span>
        <span class="mapPinEmoji">${glyph}</span>
        <span class="mapPinValue">${merchant.rewardMultiplier.toFixed(1)}x</span>
      </button>
    `,
    iconSize: [94, 42],
    iconAnchor: [47, 42],
    popupAnchor: [0, -34],
  });
}

function buildMerchantPopup(merchant: MerchantPinType) {
  const pin = classifyPin(merchant.rewardMultiplier, merchant.isSponsored, merchant.isTrending);
  const glyph = PIN_GLYPHS[pin.emoji] ?? PIN_GLYPHS.DOT;
  const topQuest = merchant.quests[0];
  const shortWallet = `${merchant.wallet.slice(0, 6)}...${merchant.wallet.slice(-4)}`;
  const solscanUrl = `https://solscan.io/account/${encodeURIComponent(merchant.wallet)}?cluster=devnet`;

  return `
    <div class="pinPopup">
      <strong>${escapeHtml(merchant.name)}</strong>
      <p>${glyph} ${escapeHtml(pin.label)} - ${escapeHtml(merchant.category)}</p>
      <p>${escapeHtml(formatDistance(merchant.distance))}</p>
      <p class="pinPopupWallet" title="${escapeHtml(merchant.wallet)}">Merchant wallet: ${escapeHtml(shortWallet)}</p>
      ${
        topQuest
          ? `<p class="pinPopupReward">${escapeHtml(formatReward(topQuest.rewardAmount, topQuest.rewardToken))}</p>`
          : ""
      }
      <a class="pinPopupWalletLink" href="${solscanUrl}" target="_blank" rel="noreferrer">View on Solscan</a>
    </div>
  `;
}

function buildUserIcon() {
  return new DivIcon({
    className: "userLocationMarker",
    html: `
      <div class="userLocationPin" aria-hidden="true">
        <span class="userLocationPulse"></span>
        <span class="userLocationCore"></span>
        <span class="userLocationBadge">YOU</span>
      </div>
    `,
    iconSize: [84, 84],
    iconAnchor: [42, 42],
  });
}

function addUserLocation(
  layers: LayerGroup,
  position: LatLngExpression,
  accuracy: number | null | undefined,
  icon: DivIcon
) {
  if (accuracy) {
    circle(position, {
      radius: Math.max(accuracy, 22),
      className: "userAccuracyHalo",
      color: "transparent",
      fillColor: "#14f195",
      fillOpacity: 0.16,
    }).addTo(layers);
  }

  marker(position, { icon, interactive: false }).addTo(layers);
}

function addHeatNode(layers: LayerGroup, node: HeatmapNode, index: number) {
  const tone = node.weight > 0.66 ? "heatPulseStrong" : node.weight > 0.4 ? "heatPulseMid" : "heatPulseSoft";
  const position: LatLngExpression = [node.lat, node.lng];

  circle(position, {
    radius: 110 + node.weight * 240,
    className: `heatPulse ${tone}`,
    color: "transparent",
    fillColor: node.weight > 0.66 ? "#ff6b2c" : node.weight > 0.4 ? "#9945ff" : "#14f195",
    fillOpacity: 0.08 + node.weight * 0.08,
  }).addTo(layers);

  circle(position, {
    radius: 40 + node.weight * 90 + index,
    className: "heatPulseCore",
    color: "transparent",
    fillColor: node.weight > 0.66 ? "#ff6b2c" : "#14f195",
    fillOpacity: 0.14,
  }).addTo(layers);
}

function addMerchant(
  layers: LayerGroup,
  merchant: MerchantPinType,
  selected: boolean,
  onSelectMerchant: (merchant: MerchantPinType) => void
) {
  const merchantMarker = marker([merchant.lat, merchant.lng], {
    icon: buildMerchantIcon(merchant, selected),
  }).bindPopup(buildMerchantPopup(merchant));

  merchantMarker.on("click", () => onSelectMerchant(merchant));
  merchantMarker.addTo(layers);
}

function addRouteVisualization(
  layers: LayerGroup,
  userLocation: { lat: number; lng: number },
  merchant: MerchantPinType
) {
  const routePoints: LatLngExpression[] = [
    [userLocation.lat, userLocation.lng],
    [merchant.lat, merchant.lng],
  ];

  polyline(routePoints, {
    className: "demoRouteLineGlow",
    color: "#14f195",
    weight: 14,
    opacity: 0.18,
    lineCap: "round",
    lineJoin: "round",
  }).addTo(layers);

  polyline(routePoints, {
    className: "demoRouteLineCore",
    color: "#ffd166",
    weight: 4,
    opacity: 0.95,
    lineCap: "round",
    lineJoin: "round",
    dashArray: "14 10",
  }).addTo(layers);

  circle([merchant.lat, merchant.lng], {
    radius: 56,
    className: "routeDestinationPulse",
    color: "#ffd166",
    weight: 1.5,
    fillColor: "#ffd166",
    fillOpacity: 0.12,
  }).addTo(layers);
}

function removeExistingLeafletInstance(container: HTMLDivElement) {
  const leafletContainer = container as HTMLDivElement & { _leaflet_id?: number };

  if (leafletContainer._leaflet_id) {
    delete leafletContainer._leaflet_id;
  }
}

type MapViewProps = {
  center: { lat: number; lng: number };
  focusLocation: { lat: number; lng: number };
  recenterSignal?: number;
  userAccuracy?: number | null;
  merchants: MerchantPinType[];
  heatmapData: HeatmapNode[];
  selectedMerchantId?: string | null;
  routeActive?: boolean;
  routeMerchant?: MerchantPinType | null;
  routeReward?: string;
  routeBoost?: string;
  onSelectMerchant: (merchant: MerchantPinType) => void;
};

export function MapView({
  center,
  focusLocation,
  recenterSignal = 0,
  userAccuracy,
  merchants,
  heatmapData,
  selectedMerchantId,
  routeActive = false,
  routeMerchant = null,
  routeReward = "0.77 USDC",
  routeBoost = "1.4x",
  onSelectMerchant,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const overlayRef = useRef<LayerGroup | null>(null);
  const initialCenterRef = useRef(center);
  const userIcon = useMemo(() => buildUserIcon(), []);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || mapRef.current) {
      return;
    }

    removeExistingLeafletInstance(container);

    const map = new LeafletMap(container, {
      center: initialCenterRef.current,
      zoom: 15,
      zoomControl: false,
    });

    tileLayer(mapTiles, {
      attribution: mapAttribution,
      detectRetina: true,
    }).addTo(map);

    const overlays = layerGroup().addTo(map);
    mapRef.current = map;
    overlayRef.current = overlays;

    return () => {
      overlays.clearLayers();
      map.remove();
      overlayRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.flyTo([focusLocation.lat, focusLocation.lng], 15.6, {
      animate: true,
      duration: 1.15,
      easeLinearity: 0.2,
    });
  }, [focusLocation.lat, focusLocation.lng]);

  useEffect(() => {
    if (!recenterSignal) {
      return;
    }

    mapRef.current?.flyTo([center.lat, center.lng], 15.6, {
      animate: true,
      duration: 0.9,
      easeLinearity: 0.2,
    });
  }, [center.lat, center.lng, recenterSignal]);

  useEffect(() => {
    const overlays = overlayRef.current;

    if (!overlays) {
      return;
    }

    overlays.clearLayers();
    addUserLocation(overlays, [center.lat, center.lng], userAccuracy, userIcon);

    if (routeActive && routeMerchant) {
      addRouteVisualization(overlays, center, routeMerchant);
    }

    heatmapData.forEach((node, index) => {
      addHeatNode(overlays, node, index);
    });

    merchants.forEach((merchant) => {
      addMerchant(overlays, merchant, merchant.id === selectedMerchantId, onSelectMerchant);
    });
  }, [
    center,
    heatmapData,
    merchants,
    onSelectMerchant,
    routeActive,
    routeMerchant,
    selectedMerchantId,
    userAccuracy,
    userIcon,
  ]);

  return (
    <div className="mapShell">
      <div ref={containerRef} className="mapCanvas" />
      {routeActive && routeMerchant ? (
        <div className="demoRouteHud" aria-live="polite">
          <span className="demoRouteLabel">Route Active</span>
          <strong>{routeMerchant.name}</strong>
          <div className="demoRouteChips">
            <span>{routeReward}</span>
            <span>{routeBoost} boost</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
