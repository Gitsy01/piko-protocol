"use client";

import { useEffect, useState } from "react";
import { DEMO_MODE_ENABLED, appendDemoQuery, hasDemoModeQuery } from "@/lib/demo-mode";

export function useDemoMode() {
  const [queryEnabled, setQueryEnabled] = useState(false);

  useEffect(() => {
    setQueryEnabled(hasDemoModeQuery(new URLSearchParams(window.location.search)));
  }, []);

  const envEnabled = process.env.NODE_ENV !== "production" && DEMO_MODE_ENABLED;

  return envEnabled || queryEnabled;
}

export function useDemoHref(href: string) {
  const demoMode = useDemoMode();
  return appendDemoQuery(href, demoMode);
}
