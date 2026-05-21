"use client";

import { useEffect } from "react";
import { Editor, Frame, useEditor } from "@craftjs/core";
import type { SerializedNodes } from "@craftjs/core";
import type {
  BlockConfig,
  HeroElementsByColumn,
  LandingPageContent,
} from "@/lib/types/page";
import {
  blocksToCraftState,
  craftStateToBlocks,
} from "@/lib/craft/blockSerialization";
import { extractHeroElementsFromSerialized } from "@/lib/craft/heroSerialization";
import { blockResolver } from "./blocks";
import { BlockPalette } from "./BlockPalette";
import { getDefaultBlocksForPage } from "@/lib/blocks/defaultBlocks";

interface PageBlockLayoutEditorProps {
  page: LandingPageContent;
  onReady: (getBlocks: () => BlockConfig[]) => void;
  onHeroElementsReady?: (
    getHeroElements: () => HeroElementsByColumn | null,
  ) => void;
}

function BlockLayoutInit({
  onReady,
}: {
  onReady: (getBlocks: () => BlockConfig[]) => void;
}) {
  const { query } = useEditor();

  useEffect(() => {
    onReady(() => {
      const raw = query.serialize();
      const data =
        typeof raw === "string" ? (JSON.parse(raw) as SerializedNodes) : raw;
      return craftStateToBlocks(data);
    });
  }, [onReady, query]);

  return null;
}

function HeroLayoutInit({
  onHeroElementsReady,
}: {
  onHeroElementsReady?: (
    getHeroElements: () => HeroElementsByColumn | null,
  ) => void;
}) {
  const { query } = useEditor();

  useEffect(() => {
    if (!onHeroElementsReady) return;
    onHeroElementsReady(() => {
      const raw = query.serialize();
      const data =
        typeof raw === "string" ? (JSON.parse(raw) as SerializedNodes) : raw;
      return extractHeroElementsFromSerialized(data);
    });
  }, [onHeroElementsReady, query]);

  return null;
}

export function PageBlockLayoutEditor({
  page,
  onReady,
  onHeroElementsReady,
}: PageBlockLayoutEditorProps) {
  const initialBlocks: BlockConfig[] =
    page.blocks && page.blocks.length > 0
      ? page.blocks
      : getDefaultBlocksForPage(page);

  const initialData = blocksToCraftState(initialBlocks);

  return (
    <Editor resolver={blockResolver}>
      <BlockLayoutInit onReady={onReady} />
      <HeroLayoutInit onHeroElementsReady={onHeroElementsReady} />
      <div className="flex min-h-[420px] gap-4">
        <aside className="w-[260px] shrink-0 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4">
          <BlockPalette />
        </aside>
        <main className="min-h-[360px] flex-1 rounded-lg border-2 border-dashed border-zinc-200 bg-white p-4">
          <p className="mb-3 text-md font-medium text-zinc-500">
            Page canvas — drop blocks here
          </p>
          <div className="min-h-[320px] rounded-lg border border-zinc-100 bg-zinc-50/50 p-4">
            <Frame data={initialData} />
          </div>
        </main>
      </div>
    </Editor>
  );
}
