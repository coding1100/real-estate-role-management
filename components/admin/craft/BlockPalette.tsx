"use client";

import React from "react";
import { useEditor } from "@craftjs/core";
import type { BlockKind } from "@/lib/types/page";
import { generateBlockId } from "@/lib/craft/blockSerialization";
import {
  HeaderBlock,
  HeroLayoutBlock,
  HeroHeadlineBlock,
  HeroSubheadlineBlock,
  HeroLeftRichTextBlock,
  HeroFormBlock,
  HeroTrustRowBlock,
  HeroBadgeStripBlock,
} from "./blocks";
import { GripVertical } from "lucide-react";

type BlockEntry = {
  kind: BlockKind;
  label: string;
  Component: React.ComponentType<{
    id: string;
    kind: string;
    props: Record<string, unknown>;
  }>;
};

const BLOCK_ENTRIES: BlockEntry[] = [
  { kind: "header", label: "Header", Component: HeaderBlock },
  { kind: "heroLayout", label: "Hero layout", Component: HeroLayoutBlock },
  { kind: "heroHeadline", label: "Hero headline", Component: HeroHeadlineBlock },
  {
    kind: "heroSubheadline",
    label: "Hero subheadline",
    Component: HeroSubheadlineBlock,
  },
  {
    kind: "heroLeftRichText",
    label: "Hero left content",
    Component: HeroLeftRichTextBlock,
  },
  { kind: "heroForm", label: "Hero form", Component: HeroFormBlock },
  { kind: "heroTrustRow", label: "Hero trust row", Component: HeroTrustRowBlock },
  {
    kind: "heroBadgeStrip",
    label: "Hero badges",
    Component: HeroBadgeStripBlock,
  },
];

export function BlockPalette() {
  const { connectors, query } = useEditor();

  return (
    <div className="flex flex-col gap-1">
      <p className="mb-2 text-md font-semibold uppercase tracking-wide text-zinc-500">
        Drag blocks here
      </p>
      <div className="flex flex-col gap-2">
        {BLOCK_ENTRIES.map((entry) => (
          <div
            key={entry.kind}
            ref={(ref) => {
              if (!ref) return;
              connectors.create(
                ref,
                () =>
                  query
                    .parseReactElement(
                      React.createElement(entry.Component, {
                        id: generateBlockId(),
                        kind: entry.kind,
                        props: {},
                      }),
                    )
                    .toNodeTree(),
              );
            }}
            className="flex cursor-grab items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-md shadow-sm active:cursor-grabbing hover:border-zinc-300 hover:bg-zinc-50"
          >
            <GripVertical className="h-4 w-4 shrink-0 text-zinc-400" />
            <span className="font-medium text-zinc-800">{entry.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
