"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getNearbyMerchants, getSuggestions } from "@/lib/api";
import { demoMerchants } from "@/lib/demo-data";
import { HeatmapNode, MapSuggestion, MerchantPinType } from "@/lib/types";

const DEFAULT_LOCATION = { lat: 28.6139, lng: 77.209 };
const REFRESH_DISTANCE_METERS = 120;
const DEMO_MERCHANTS = demoMerchants.slice(0, 5);
const DEMO_CLUSTER_CENTER = DEMO_MERCHANTS.reduce(
  (accumulator, merchant) => ({
    lat: accumulator.lat + merchant.lat / DEMO_MERCHANTS.length,
    lng: accumulator.lng + merchant.lng / DEMO_MERCHANTS.length,
  }),
  { lat: 0, lng: 0 }
);

type LocationStatus = "locating" | "tracking" | "fallback" | "unsupported" | "denied";

function distanceBetweenMeters(
  left: { lat: number; lng: number },
  right: { lat: number; lng: number }
) {
  const earthRadius = 6_371_000;
  const latDelta = ((right.lat - left.lat) * Math.PI) / 180;
  const lngDelta = ((right.lng - left.lng) * Math.PI) / 180;
  const leftLat = (left.lat * Math.PI) / 180;
  const rightLat = (right.lat * Math.PI) / 180;

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDemoMerchantFallback(origin: { lat: number; lng: number }) {
  return DEMO_MERCHANTS.map((merchant) => {
    const projected = {
      ...merchant,
      lat: origin.lat + (merchant.lat - DEMO_CLUSTER_CENTER.lat),
      lng: origin.lng + (merchant.lng - DEMO_CLUSTER_CENTER.lng),
    };

    return {
      ...projected,
      distance: distanceBetweenMeters(origin, projected),
    };
  });
}

function getDemoHeatmapFallback(origin: { lat: number; lng: number }): HeatmapNode[] {
  return getDemoMerchantFallback(origin).map((merchant) => ({
    lat: merchant.lat,
    lng: merchant.lng,
    weight: Math.min(merchant.rewardMultiplier / 3, 1),
  }));
}

export function useMerchantMap() {
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [searchLocation, setSearchLocation] = useState(DEFAULT_LOCATION);
  const [merchants, setMerchants] = useState<MerchantPinType[]>(() => getDemoMerchantFallback(DEFAULT_LOCATION));
  const [heatmapData, setHeatmapData] = useState<HeatmapNode[]>(() => getDemoHeatmapFallback(DEFAULT_LOCATION));
  const [suggestions, setSuggestions] = useState<MapSuggestion[]>([]);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("locating");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const usingDemoFallbackRef = useRef(true);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      return;
    }

    const syncPosition = (position: GeolocationPosition) => {
      const nextLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      setLocation(nextLocation);
      setAccuracy(position.coords.accuracy ?? null);
      setLastUpdatedAt(Date.now());
      setLocationStatus("tracking");

      if (usingDemoFallbackRef.current) {
        setMerchants(getDemoMerchantFallback(nextLocation));
        setHeatmapData(getDemoHeatmapFallback(nextLocation));
      }

      setSearchLocation((current) =>
        distanceBetweenMeters(current, nextLocation) >= REFRESH_DISTANCE_METERS ? nextLocation : current
      );
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        syncPosition(position);
      },
      (error) => {
        setLocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : "fallback");
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 5_000 }
    );

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        syncPosition(position);
      },
      (error) => {
        setLocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : "fallback");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {
    setSearchLocation((current) =>
      merchants.length === 0 && distanceBetweenMeters(current, location) > 0 ? location : current
    );
  }, [location, merchants.length]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [merchantResult, suggestionResult] = await Promise.all([
        getNearbyMerchants(searchLocation.lat, searchLocation.lng),
        getSuggestions(searchLocation.lat, searchLocation.lng),
      ]);

      if (cancelled) return;

      setMerchants(merchantResult.merchants);
      setHeatmapData(merchantResult.heatmapData);
      setSuggestions(suggestionResult.suggestions);
      usingDemoFallbackRef.current = false;
      setLoading(false);

      // Offline merchant cache
      try {
        localStorage.setItem(
          "piko:merchant-cache",
          JSON.stringify({
            timestamp: Date.now(),
            merchants: merchantResult.merchants,
            heatmapData: merchantResult.heatmapData,
          })
        );
      } catch {
        // Ignore storage failures
      }
    }

    load().catch(() => {
      // Restore from offline cache
      try {
        const cached = localStorage.getItem("piko:merchant-cache");
        if (cached) {
          const parsed = JSON.parse(cached) as {
            merchants: MerchantPinType[];
            heatmapData: HeatmapNode[];
          };
          setMerchants(parsed.merchants);
          setHeatmapData(parsed.heatmapData);
          usingDemoFallbackRef.current = false;
        }
      } catch {
        // Ignore parse errors
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [searchLocation.lat, searchLocation.lng]);

  const featured = useMemo(
    () => merchants.slice().sort((a, b) => b.rewardMultiplier - a.rewardMultiplier)[0] ?? null,
    [merchants]
  );

  const locationLabel = useMemo(() => {
    if (locationStatus === "tracking") {
      if (accuracy && accuracy < 25) return "Live location";
      if (accuracy && accuracy < 80) return "Tracking nearby";
      return "Updating your position";
    }

    if (locationStatus === "denied") return "Location access denied";
    if (locationStatus === "unsupported") return "Location unavailable";
    if (locationStatus === "fallback") return "Using fallback location";
    return "Finding your location";
  }, [accuracy, locationStatus]);

  return {
    location,
    accuracy,
    locationStatus,
    locationLabel,
    lastUpdatedAt,
    merchants,
    heatmapData,
    suggestions,
    featured,
    loading,
  };
}
