"use client";

import { useEffect, useState } from "react";
import { DEMO_MODE_ENABLED, appendDemoQuery, hasDemoModeQuery } from "@/lib/demo-mode";

export function useDemoMode() {
  const [queryEnabled, setQueryEnabled] = useState(false);

  useEffect(() => {
    setQueryEnabled(hasDemoModeQuery(new URLSearchParams(window.location.search)));
  }, []);

  return DEMO_MODE_ENABLED || queryEnabled;
}

export function useDemoHref(href: string) {
  const demoMode = useDemoMode();
  return appendDemoQuery(href, demoMode);
}
