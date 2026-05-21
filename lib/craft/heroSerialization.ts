import type { SerializedNodes } from "@craftjs/core";
import type {
  HeroElementConfig,
  HeroElementKind,
  HeroElementsByColumn,
} from "@/lib/types/page";

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

const HERO_KIND_BY_RESOLVED_NAME: Record<string, HeroElementKind> = {
  HeroHeadlineBlock: "heroHeadline",
  HeroSubheadlineBlock: "heroSubheadline",
  HeroLeftRichTextBlock: "heroLeftRichText",
  HeroFormBlock: "heroForm",
  HeroTrustRowBlock: "heroTrustRow",
  HeroBadgeStripBlock: "heroBadgeStrip",
};

function toHeroElements(
  data: CraftSerializedState,
  canvasId: string | undefined,
  column: "left" | "right",
): HeroElementConfig[] {
  if (!canvasId) return [];
  const canvas = data[canvasId];
  if (!canvas || !Array.isArray(canvas.nodes)) return [];

  const result: HeroElementConfig[] = [];

  for (const nodeId of canvas.nodes) {
    const node = data[nodeId];
    if (!node) continue;

    const resolvedName =
      typeof node.type === "object" && node.type && "resolvedName" in node.type
        ? (node.type as { resolvedName: string }).resolvedName
        : null;

    const kind = resolvedName
      ? HERO_KIND_BY_RESOLVED_NAME[resolvedName]
      : undefined;

    if (!kind) continue;

    const props = (node.props ?? {}) as {
      id?: string;
      hidden?: boolean;
    };

    result.push({
      id: typeof props.id === "string" ? props.id : nodeId,
      kind,
      column,
      hidden: props.hidden === true,
    });
  }

  return result;
}

export function extractHeroElementsFromSerialized(
  serialized: SerializedNodes,
): HeroElementsByColumn | null {
  const data = serialized as unknown as CraftSerializedState;
  const root = data.ROOT;
  if (!root || !Array.isArray(root.nodes)) return null;

  const heroLayoutId = root.nodes.find((nodeId) => {
    const node = data[nodeId];
    if (!node) return false;
    const resolvedName =
      typeof node.type === "object" && node.type && "resolvedName" in node.type
        ? (node.type as { resolvedName: string }).resolvedName
        : null;
    return resolvedName === "HeroLayoutBlock";
  });

  if (!heroLayoutId) return null;

  const heroLayoutNode = data[heroLayoutId];
  const [leftCanvasId, rightCanvasId] = Array.isArray(heroLayoutNode.nodes)
    ? heroLayoutNode.nodes
    : [];

  return {
    left: toHeroElements(data, leftCanvasId, "left"),
    right: toHeroElements(data, rightCanvasId, "right"),
  };
}

