"use client";

import { DivIcon } from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { MerchantPinType } from "@/lib/types";
import { classifyPin, formatDistance, formatReward } from "@/lib/utils";

type MerchantPinProps = {
  merchant: MerchantPinType;
  selected: boolean;
  onSelect: (merchant: MerchantPinType) => void;
};

const PIN_GLYPHS: Record<string, string> = {
  FIRE: "F",
  STAR: "*",
  BOLT: "+",
  DOT: ".",
};

function animationDelayFromId(id: string) {
  return ((id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 8) * 0.18).toFixed(2);
}

function buildIcon(merchant: MerchantPinType, selected: boolean) {
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

export function MerchantPin({ merchant, selected, onSelect }: MerchantPinProps) {
  const pin = classifyPin(merchant.rewardMultiplier, merchant.isSponsored, merchant.isTrending);
  const glyph = PIN_GLYPHS[pin.emoji] ?? PIN_GLYPHS.DOT;
  const topQuest = merchant.quests[0];
  const shortWallet = `${merchant.wallet.slice(0, 6)}...${merchant.wallet.slice(-4)}`;
  const solscanUrl = `https://solscan.io/account/${merchant.wallet}?cluster=devnet`;

  return (
    <Marker
      position={[merchant.lat, merchant.lng]}
      icon={buildIcon(merchant, selected)}
      eventHandlers={{ click: () => onSelect(merchant) }}
    >
      <Popup>
        <div className="pinPopup">
          <strong>{merchant.name}</strong>
          <p>
            {glyph} {pin.label} - {merchant.category}
          </p>
          <p>{formatDistance(merchant.distance)}</p>
          <p className="pinPopupWallet" title={merchant.wallet}>
            Merchant wallet: {shortWallet}
          </p>
          {topQuest ? (
            <p className="pinPopupReward">{formatReward(topQuest.rewardAmount, topQuest.rewardToken)}</p>
          ) : null}
          <a className="pinPopupWalletLink" href={solscanUrl} target="_blank" rel="noreferrer">
            View on Solscan
          </a>
        </div>
      </Popup>
    </Marker>
  );
}
