"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type LoaderPhase = "idle" | "loading" | "complete";
const MIN_VISIBLE_MS = 300;
const COMPLETE_FADE_MS = 350;
const SAFETY_TIMEOUT_MS = 8000;

export default function TopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(
    () => `${pathname ?? ""}?${searchParams?.toString() ?? ""}`,
    [pathname, searchParams],
  );

  const [phase, setPhase] = useState<LoaderPhase>("idle");
  const hideTimerRef = useRef<number | null>(null);
  const completeTimerRef = useRef<number | null>(null);
  const safetyTimeoutRef = useRef<number | null>(null);
  const pendingRouteKeyRef = useRef<string | null>(null);
  const loadingStartedAtRef = useRef<number>(0);

  const clearTimers = () => {
    if (completeTimerRef.current) {
      window.clearTimeout(completeTimerRef.current);
      completeTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (safetyTimeoutRef.current) {
      window.clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
  };

  const finishLoading = () => {
    clearTimers();
    setPhase("complete");
    hideTimerRef.current = window.setTimeout(() => {
      setPhase("idle");
      pendingRouteKeyRef.current = null;
    }, COMPLETE_FADE_MS);
  };

  useEffect(() => {
    const startLoading = (nextKey: string) => {
      if (pendingRouteKeyRef.current === nextKey && phase === "loading") return;
      clearTimers();
      pendingRouteKeyRef.current = nextKey;
      loadingStartedAtRef.current = Date.now();
      setPhase("loading");

      safetyTimeoutRef.current = window.setTimeout(() => {
        finishLoading();
      }, SAFETY_TIMEOUT_MS);
    };

    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const nextKey = `${url.pathname}?${url.searchParams.toString()}`;
      const currentKey = `${window.location.pathname}?${window.location.search.replace(/^\?/, "")}`;
      if (nextKey === currentKey) return;

      startLoading(nextKey);
    };

    const onPopState = () => {
      const nextKey = `${window.location.pathname}?${window.location.search.replace(/^\?/, "")}`;
      startLoading(nextKey);
    };

    document.addEventListener("click", onDocumentClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "loading") return;
    const targetKey = pendingRouteKeyRef.current;
    if (!targetKey) return;

    if (routeKey !== targetKey) return;

    const elapsed = Date.now() - loadingStartedAtRef.current;
    const waitMs = Math.max(0, MIN_VISIBLE_MS - elapsed);
    completeTimerRef.current = window.setTimeout(() => {
      finishLoading();
    }, waitMs);
  }, [routeKey, phase]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  if (phase === "idle") return null;

  return (
    <div
      className={`top-loader top-loader--${phase}`}
      aria-hidden="true"
      role="presentation"
    />
  );
}
