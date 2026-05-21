import type { SerializedNodes } from "@craftjs/core";
import type { BlockConfig, BlockKind } from "@/lib/types/page";

const BLOCK_KINDS: BlockKind[] = [
  "header",
  "heroLayout",
  "heroHeadline",
  "heroSubheadline",
  "heroLeftRichText",
  "heroForm",
  "heroTrustRow",
  "heroBadgeStrip",
];

const KIND_TO_RESOLVED_NAME: Record<BlockKind, string> = {
  header: "HeaderBlock",
  heroLayout: "HeroLayoutBlock",
  heroHeadline: "HeroHeadlineBlock",
  heroSubheadline: "HeroSubheadlineBlock",
  heroLeftRichText: "HeroLeftRichTextBlock",
  heroForm: "HeroFormBlock",
  heroTrustRow: "HeroTrustRowBlock",
  heroBadgeStrip: "HeroBadgeStripBlock",
};

const RESOLVED_NAME_TO_KIND: Record<string, BlockKind> = {
  HeaderBlock: "header",
  HeroLayoutBlock: "heroLayout",
  HeroHeadlineBlock: "heroHeadline",
  HeroSubheadlineBlock: "heroSubheadline",
  HeroLeftRichTextBlock: "heroLeftRichText",
  HeroFormBlock: "heroForm",
  HeroTrustRowBlock: "heroTrustRow",
  HeroBadgeStripBlock: "heroBadgeStrip",
};

type CraftNodeData = {
  type: string | { resolvedName: string };
  isCanvas?: boolean;
  props: Record<string, unknown>;
  parent: string | null;
  displayName: string;
  custom: Record<string, unknown>;
  nodes: string[];
};

type CraftSerializedState = Record<string, CraftNodeData>;

export function generateBlockId(): string {
  return `block-${Math.random().toString(36).slice(2, 11)}`;
}

export function blocksToCraftState(blocks: BlockConfig[]): SerializedNodes {
  const state: CraftSerializedState = {};
  const rootChildIds: string[] = [];

  blocks.forEach((block) => {
    const nodeId = block.id.startsWith("block-") ? block.id : generateBlockId();
    rootChildIds.push(nodeId);
    const resolvedName =
      KIND_TO_RESOLVED_NAME[block.kind] ?? "HeroHeadlineBlock";
    state[nodeId] = {
      type: { resolvedName },
      props: {
        id: block.id,
        kind: block.kind,
        props: block.props ?? {},
        hidden: block.hidden === true,
      },
      parent: "ROOT",
      displayName: resolvedName,
      custom: {},
      nodes: [],
    };
  });

  state.ROOT = {
    type: "div",
    isCanvas: true,
    props: {},
    parent: null,
    displayName: "div",
    custom: {},
    nodes: rootChildIds,
  };

  return state as unknown as SerializedNodes;
}

export function craftStateToBlocks(serialized: SerializedNodes): BlockConfig[] {
  const data = serialized as unknown as CraftSerializedState;
  const root = data.ROOT;
  if (!root || !Array.isArray(root.nodes)) return [];

  const blocks: BlockConfig[] = [];

  for (const nodeId of root.nodes) {
    const node = data[nodeId];
    if (!node) continue;

    const resolvedName =
      typeof node.type === "object" && node.type && "resolvedName" in node.type
        ? (node.type as { resolvedName: string }).resolvedName
        : null;

    const kind: BlockKind | null = resolvedName
      ? RESOLVED_NAME_TO_KIND[resolvedName] ?? null
      : null;

    if (!kind) continue;

    const props = (node.props ?? {}) as {
      id?: string;
      kind?: string;
      props?: Record<string, unknown>;
      hidden?: boolean;
    };

    blocks.push({
      id: typeof props.id === "string" ? props.id : generateBlockId(),
      kind,
      props: props.props ?? {},
      hidden: props.hidden === true,
    });
  }

  return blocks;
}

