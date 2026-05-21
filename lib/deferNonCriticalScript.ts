/**
 * Schedules work after the browser has reported LCP (if available) or window load,
 * then after the next paint and in an idle period — keeps third‑party scripts off
 * the FCP/LCP critical path.
 */
export function deferUntilAfterLcpOrLoad(callback: () => void): () => void {
  let cancelled = false;
  let triggered = false;
  let idleCleanup: (() => void) | undefined;

  const runInIdle = (cb: () => void): (() => void) => {
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => cb(), { timeout: 8000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(() => cb(), 1);
    return () => clearTimeout(t);
  };

  const schedule = () => {
    if (cancelled || triggered) return;
    triggered = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        idleCleanup = runInIdle(() => {
          if (!cancelled) callback();
        });
      });
    });
  };

  let po: PerformanceObserver | undefined;
  try {
    po = new PerformanceObserver(() => {
      schedule();
      try {
        po?.disconnect();
      } catch {
        /* ignore */
      }
    });
    po.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    /* LCP not supported */
  }

  const onLoad = () => schedule();
  if (document.readyState === "complete") {
    queueMicrotask(onLoad);
  } else {
    window.addEventListener("load", onLoad, { once: true });
  }

  const fallback = setTimeout(schedule, 10000);

  return () => {
    cancelled = true;
    clearTimeout(fallback);
    window.removeEventListener("load", onLoad);
    idleCleanup?.();
    try {
      po?.disconnect();
    } catch {
      /* ignore */
    }
  };
}

const INTERACTION_EVENTS = [
  "scroll",
  "pointerdown",
  "keydown",
  "touchstart",
] as const;

/**
 * Runs after the first real user gesture (or `timeoutMs` for bots / no-scroll),
 * then two animation frames + idle. Keeps analytics pixels off the initial paint
 * and Lighthouse “navigation” phase unless the user engages.
 */
export function deferUntilInteractionOrTimeout(
  callback: () => void,
  timeoutMs = 45000,
): () => void {
  let cancelled = false;
  let ran = false;
  let idleCleanup: (() => void) | undefined;

  const runInIdle = (cb: () => void): (() => void) => {
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => cb(), { timeout: 8000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(() => cb(), 1);
    return () => clearTimeout(t);
  };

  const schedule = () => {
    if (cancelled || ran) return;
    ran = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        idleCleanup = runInIdle(() => {
          if (!cancelled) callback();
        });
      });
    });
  };

  const removeListeners = () => {
    INTERACTION_EVENTS.forEach((ev) => {
      window.removeEventListener(ev, onInteraction);
    });
  };

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const onInteraction = () => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    removeListeners();
    schedule();
  };

  INTERACTION_EVENTS.forEach((ev) => {
    window.addEventListener(ev, onInteraction, { passive: true, capture: true });
  });

  timeoutId = setTimeout(() => {
    removeListeners();
    schedule();
  }, timeoutMs);

  return () => {
    cancelled = true;
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    removeListeners();
    idleCleanup?.();
  };
}
