"use client";

import { Element } from "@craftjs/core";

export function HeroLayoutBlock() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-300 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-700">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,left,rgba(255,255,255,0.18),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.12),transparent_55%)] opacity-70" />
      <div className="relative grid gap-4 px-4 py-5 md:grid-cols-2 md:px-6 md:py-6">
        <div className="min-h-[180px] rounded-lg bg-black/15 p-3 md:p-4">
          <p className="mb-2 text-[14px] font-semibold uppercase tracking-[0.18em] text-zinc-200">
            Content (matches hero left)
          </p>
          <div className="space-y-2 !rounded-md border border-dashed border-zinc-500/60 bg-black/20 p-3">
            <Element id="heroLeft" is="div" canvas />
          </div>
        </div>
        <div className="min-h-[180px] rounded-lg bg-black/25 p-3 md:p-4">
          <p className="mb-2 text-[14px] font-semibold uppercase tracking-[0.18em] text-zinc-200">
            Form column (matches hero right)
          </p>
          <div className="space-y-2 !rounded-md border border-dashed border-zinc-500/60 bg-black/30 p-3">
            <Element id="heroRight" is="div" canvas />
          </div>
        </div>
      </div>
    </div>
  );
}

