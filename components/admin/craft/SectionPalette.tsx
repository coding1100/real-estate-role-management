"use client";

import React from "react";
import { useEditor } from "@craftjs/core";
import { generateId } from "@/lib/craft/sectionSerialization";
import type { SectionConfig } from "@/lib/types/page";
import { HeroBlock } from "./SectionBlocks";

const SECTION_ENTRIES: {
  kind: SectionConfig["kind"];
  label: string;
  Component: React.ComponentType<{ id: string; kind: string; props: Record<string, unknown> }>;
}[] = [{ kind: "hero", label: "Hero", Component: HeroBlock }];

export function SectionPalette() {
  const { actions, query } = useEditor();

  function addSection(
    kind: SectionConfig["kind"],
    Component: React.ComponentType<{ id: string; kind: string; props: Record<string, unknown> }>,
  ) {
    const id = generateId();
    const nodeTree = query
      .parseReactElement(
        React.createElement(Component, { id, kind, props: {} }),
      )
      .toNodeTree();
    actions.addNodeTree(nodeTree, "ROOT");
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <p className="mb-2 text-md font-semibold uppercase tracking-wide text-gray-500">
        Add section
      </p>
      <div className="flex flex-wrap gap-2">
        {SECTION_ENTRIES.map(({ kind, label, Component }) => (
          <button
            key={kind}
            type="button"
            onClick={() => addSection(kind, Component)}
            className="!rounded-md border border-gray-300 bg-white px-3 py-1.5 text-md font-medium text-gray-700 hover:bg-gray-50"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
