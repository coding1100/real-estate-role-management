"use client";

import { useEffect } from "react";
import { Editor, Frame, useEditor } from "@craftjs/core";
import type { SerializedNodes } from "@craftjs/core";
import {
  sectionsToCraftState,
  craftStateToSections,
} from "@/lib/craft/sectionSerialization";
import type { SectionConfig } from "@/lib/types/page";
import { sectionBlockResolver } from "./SectionBlocks";
import { SectionPalette } from "./SectionPalette";

interface PageLayoutEditorProps {
  sections: SectionConfig[];
  onReady: (getSections: () => SectionConfig[]) => void;
}

function LayoutEditorInit({
  onReady,
}: {
  onReady: (getSections: () => SectionConfig[]) => void;
}) {
  const { query } = useEditor();
  useEffect(() => {
    onReady(() => {
      const raw = query.serialize();
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      return craftStateToSections(data);
    });
  }, [onReady, query]);
  return null;
}

export function PageLayoutEditor({ sections, onReady }: PageLayoutEditorProps) {
  const initialData = sectionsToCraftState(sections ?? []) as unknown as SerializedNodes;

  return (
    <Editor resolver={sectionBlockResolver}>
      <LayoutEditorInit onReady={onReady} />
      <div className="flex flex-col gap-4">
        <SectionPalette />
        <div className="min-h-[200px] rounded-lg border border-gray-200 bg-gray-50/50 p-4">
          <Frame data={initialData} />
        </div>
      </div>
    </Editor>
  );
}
