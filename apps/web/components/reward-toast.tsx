"use client";

import { useEffect, useState } from "react";

type RewardToastProps = {
  title: string;
  body: string;
  highlight?: string;
  onClose: () => void;
};

export function RewardToast({ title, body, highlight, onClose }: RewardToastProps) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setClosing(true), 3600);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!closing) {
      return;
    }

    const timeout = window.setTimeout(onClose, 280);
    return () => window.clearTimeout(timeout);
  }, [closing, onClose]);

  return (
    <div className={`rewardToast ${closing ? "closing" : ""}`} role="status" aria-live="polite">
      <div className="rewardConfetti" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="rewardToastCopy">
        <p className="eyebrow">Reward settled</p>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>

      {highlight ? <div className="rewardToastHighlight">{highlight}</div> : null}

      <button type="button" onClick={() => setClosing(true)} aria-label="Close toast">
        x
      </button>
    </div>
  );
}
