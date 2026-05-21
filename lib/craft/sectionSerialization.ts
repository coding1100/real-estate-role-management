import type { SectionConfig } from "@/lib/types/page";

const SECTION_KINDS = ["hero"] as const;

const KIND_TO_RESOLVED_NAME: Record<(typeof SECTION_KINDS)[number], string> = {
  hero: "HeroBlock",
};

const RESOLVED_NAME_TO_KIND: Record<string, (typeof SECTION_KINDS)[number]> = {
  HeroBlock: "hero",
};

export type SectionKind = (typeof SECTION_KINDS)[number];

export interface CraftNodeData {
  type: string | { resolvedName: string };
  isCanvas?: boolean;
  props: Record<string, unknown>;
  parent: string | null;
  displayName: string;
  custom: Record<string, unknown>;
  nodes: string[];
}

export type CraftSerializedState = Record<string, CraftNodeData>;

export function generateId(): string {
  return `section-${Math.random().toString(36).slice(2, 11)}`;
}

export function sectionsToCraftState(
  sections: SectionConfig[],
): CraftSerializedState {
  const state: CraftSerializedState = {};
  const rootChildIds: string[] = [];

  sections.forEach((section) => {
    const nodeId = section.id.startsWith("section-") ? section.id : generateId();
    rootChildIds.push(nodeId);
    const resolvedName = KIND_TO_RESOLVED_NAME[section.kind] ?? "HeroBlock";
    state[nodeId] = {
      type: { resolvedName },
      props: {
        id: section.id,
        kind: section.kind,
        props: section.props ?? {},
      },
      parent: "ROOT",
      displayName: resolvedName,
      custom: {},
      nodes: [],
    };
  });

  state["ROOT"] = {
    type: "div",
    isCanvas: true,
    props: {},
    parent: null,
    displayName: "div",
    custom: {},
    nodes: rootChildIds,
  };

  return state;
}

export function craftStateToSections(
  serialized: CraftSerializedState,
): SectionConfig[] {
  const root = serialized["ROOT"];
  if (!root || !Array.isArray(root.nodes)) return [];

  const sections: SectionConfig[] = [];
  for (const nodeId of root.nodes) {
    const node = serialized[nodeId];
    if (!node) continue;

    const resolvedName =
      typeof node.type === "object" && node.type && "resolvedName" in node.type
        ? (node.type as { resolvedName: string }).resolvedName
        : null;
    const kind = resolvedName
      ? RESOLVED_NAME_TO_KIND[resolvedName] ?? "hero"
      : "hero";

    const props = (node.props ?? {}) as {
      id?: string;
      kind?: string;
      props?: Record<string, unknown>;
    };
    sections.push({
      id: typeof props.id === "string" ? props.id : generateId(),
      kind,
      props: props.props ?? {},
    });
  }
  return sections;
}
