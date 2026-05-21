"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Columns2, Link2 } from "lucide-react";
import { Node as TiptapNode } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Paragraph from "@tiptap/extension-paragraph";
import Underline from "@tiptap/extension-underline";
import { TextStyle, FontFamily, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Strike from "@tiptap/extension-strike";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import CodeBlock from "@tiptap/extension-code-block";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { wrapLegalSignsHtml } from "@/lib/richTextSigns";

interface RichTextEditorProps {
  label?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  /** Fires when focus leaves this editor (toolbar + content), not when moving within it. */
  onBlur?: () => void;
  placeholder?: string;
  height?: number;
  fontOptions?: { label: string; cssFamily: string }[];
  editorClassName?: string;
  applyBlockqoute2ToLastTextElement?: boolean;
  toolbarActions?: Array<{
    id: string;
    label: string;
    title?: string;
    active?: boolean;
    onClick: () => void;
  }>;
}

const DEFAULT_EDITOR_HEIGHT = 220;

// Paragraph node that allows a `style` attribute (for line-height, text-align, etc.)
const ParagraphWithStyle = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute("style"),
        renderHTML: (attributes) => {
          if (!attributes.style) {
            return {};
          }
          return { style: attributes.style };
        },
      },
    };
  },
});

// Custom block node rendered as <div class="tag"><span>...</span></div>
const TagBlock = TiptapNode.create({
  name: "tagBlock",
  group: "block",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: "div.tag" }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = {
      ...(HTMLAttributes || {}),
      class: ["tag", (HTMLAttributes as any)?.class].filter(Boolean).join(" "),
    };
    // Wrap inner content in a single span inside the tag div:
    // <div class="tag"><span>...</span></div>
    return ["div", attrs, ["span", 0]];
  },
});

// Bootstrap-like 2-column row container.
const TwoColRow = TiptapNode.create({
  name: "twoColRow",
  group: "block",
  content: "twoColCol twoColCol",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: "div.rte-two-col-row" }];
  },

  renderHTML({ HTMLAttributes }) {
    const existingClass =
      typeof (HTMLAttributes as Record<string, unknown>)?.class === "string"
        ? ((HTMLAttributes as Record<string, unknown>).class as string)
        : undefined;
    const attrs = {
      ...(HTMLAttributes || {}),
      class: ["rte-two-col-row", existingClass].filter(Boolean).join(" "),
    };
    return ["div", attrs, 0];
  },
});

// Each column can contain regular block content, including nested rows.
const TwoColCol = TiptapNode.create({
  name: "twoColCol",
  group: "block",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: "div.rte-two-col-col" }];
  },

  renderHTML({ HTMLAttributes }) {
    const existingClass =
      typeof (HTMLAttributes as Record<string, unknown>)?.class === "string"
        ? ((HTMLAttributes as Record<string, unknown>).class as string)
        : undefined;
    const attrs = {
      ...(HTMLAttributes || {}),
      class: ["rte-two-col-col", existingClass].filter(Boolean).join(" "),
    };
    return ["div", attrs, 0];
  },
});

const ListStyleExtension = Extension.create({
  name: "listStyleExtension",

  addGlobalAttributes() {
    return [
      {
        types: ["bulletList", "orderedList"],
        attributes: {
          dataListStyle: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-list-style"),
            renderHTML: (attributes) => {
              if (!attributes.dataListStyle) return {};
              return { "data-list-style": attributes.dataListStyle };
            },
          },
        },
      },
    ];
  },
});

export function RichTextEditor({
  label,
  value,
  onChange,
  onBlur,
  placeholder = "",
  height = DEFAULT_EDITOR_HEIGHT,
  fontOptions,
  editorClassName,
  applyBlockqoute2ToLastTextElement = false,
  toolbarActions = [],
}: RichTextEditorProps) {
  const defaultSourceSans =
    '"Source Sans 3", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const tagFontFamily =
    "Bricolage Grotesque, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const sourceSansOption = {
    label: "Source Sans 3",
    cssFamily: defaultSourceSans,
  };
  const mergedFontOptions = (() => {
    const options = [
      sourceSansOption,
      ...(fontOptions || []).filter((f) => f.label !== "Source Sans 3"),
    ];
    const seen = new Set<string>();
    return options.filter((font) => {
      const key = `${font.label}__${font.cssFamily}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  })();
  const [currentFontFamily, setCurrentFontFamily] = useState(
    sourceSansOption.cssFamily,
  );
  const [currentFontSize, setCurrentFontSize] = useState("14px");
  const [currentLineHeight, setCurrentLineHeight] = useState("1");
  const [currentListStyle, setCurrentListStyle] = useState("dot");
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const lastEmittedHtml = useRef<string | null>(null);
  const lastSelectionRef = useRef<{ from: number; to: number } | null>(null);

  const toHex6 = (value: string | null | undefined): string => {
    const raw = (value ?? "").trim();
    if (!raw) return "#000000";
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
    // rgb(r,g,b) -> #rrggbb
    const m = raw.match(
      /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i,
    );
    if (m) {
      const r = Math.max(0, Math.min(255, Number(m[1])));
      const g = Math.max(0, Math.min(255, Number(m[2])));
      const b = Math.max(0, Math.min(255, Number(m[3])));
      return (
        "#" +
        [r, g, b]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("")
          .toLowerCase()
      );
    }
    return "#000000";
  };

  const normalizeLinkHref = (rawHref: string): string | null => {
    const value = rawHref.trim();
    if (!value) return null;
    if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) return value;
    // Treat plain domains/paths as https links for frontend safety/usability.
    return `https://${value.replace(/^\/+/, "")}`;
  };

  const applyLinkFromDialog = () => {
    if (!editor) return;
    const href = normalizeLinkHref(linkDraft);
    if (!href) {
      setLinkError("Please enter a valid URL.");
      return;
    }
    const chain = editor.chain().focus();
    if (lastSelectionRef.current) {
      chain.setTextSelection(lastSelectionRef.current);
    }
    chain
      .extendMarkRange("link")
      .setLink({
        href,
        target: "_blank",
        rel: "noopener noreferrer",
      })
      .run();
    setLinkError(null);
    setShowLinkDialog(false);
  };

  const removeLinkFromDialog = () => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (lastSelectionRef.current) {
      chain.setTextSelection(lastSelectionRef.current);
    }
    chain.unsetLink().run();
    setLinkError(null);
    setShowLinkDialog(false);
  };

  const insertTwoColumnTemplate = () => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: "twoColRow",
      content: [
        {
          type: "twoColCol",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Column 1" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Add your left column content here." }],
            },
          ],
        },
        {
          type: "twoColCol",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Column 2" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Add your right column content here." }],
            },
          ],
        },
      ],
    }).run();
  };

  const insertGeneralIcon = (icon: string) => {
    if (!editor || !icon) return;
    editor.chain().focus().insertContent(icon).run();
  };

  const applyListStyle = (style: string) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (!editor.isActive("bulletList")) {
      chain.toggleBulletList().run();
    }
    editor
      .chain()
      .focus()
      .updateAttributes("bulletList", {
        dataListStyle: style === "dot" ? null : style,
      })
      .run();
    setCurrentListStyle(style);
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        paragraph: false, // we'll add our own paragraph with style support
        codeBlock: false, // we'll use separate CodeBlock extension
      }),
      ParagraphWithStyle,
      TagBlock,
      TwoColRow,
      TwoColCol,
      ListStyleExtension,
      Underline,
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      TextAlign.configure({
        // Align headings and individual paragraphs only (not whole blockquotes),
        // so each paragraph keeps its own alignment even inside a blockquote.
        types: ["heading", "paragraph"],
      }),
      Strike,
      Link.configure({
        autolink: true,
        openOnClick: false,
        linkOnPaste: true,
      }),
      Highlight,
      CodeBlock,
      HorizontalRule,
      Subscript,
      Superscript,
    ],
    content: wrapLegalSignsHtml(value),
    immediatelyRender: false,
    onUpdate({ editor }) {
      // Normalize completely empty paragraphs to <p>&nbsp;</p>
      let html = editor.getHTML();
      html = html.replace(/<p>\s*<\/p>/g, "<p>&nbsp;</p>");

      const liftListTextStyles = (rawHtml: string) => {
        // Lift identical inline text styles inside list items up onto <ul>/<ol>
        // and unwrap redundant <span style="..."> wrappers.
        try {
          if (typeof window === "undefined") return rawHtml;
          const parser = new DOMParser();
          const doc = parser.parseFromString(rawHtml, "text/html");
          const lists = Array.from(doc.querySelectorAll("ul, ol"));
          for (const list of lists) {
            const spans = Array.from(list.querySelectorAll("li span[style]"));
            if (spans.length === 0) continue;

            // Only lift if every styled span in the list shares the same style string.
            const style0 = (spans[0] as HTMLElement).getAttribute("style") || "";
            if (!style0.trim()) continue;

            const allSame = spans.every((s) => {
              const st = (s as HTMLElement).getAttribute("style") || "";
              return st.trim() === style0.trim();
            });
            if (!allSame) continue;

            // Apply style to the list itself (merge with existing).
            const existing = (list as HTMLElement).getAttribute("style") || "";
            const merged =
              existing.trim().length > 0
                ? `${existing.trim().replace(/;?\s*$/, "; ")}${style0.trim()}`
                : style0.trim();
            (list as HTMLElement).setAttribute("style", merged);

            // Unwrap the spans so styles apply from the list level.
            for (const span of spans) {
              const el = span as HTMLElement;
              // Only unwrap if the span has no attributes besides style (to avoid breaking links etc.)
              const attrNames = Array.from(el.attributes).map((a) => a.name);
              const onlyStyle =
                attrNames.length === 1 && attrNames[0].toLowerCase() === "style";
              if (!onlyStyle) continue;
              const parent = el.parentNode;
              if (!parent) continue;
              while (el.firstChild) {
                parent.insertBefore(el.firstChild, el);
              }
              parent.removeChild(el);
            }
          }
          return doc.body.innerHTML;
        } catch {
          return rawHtml;
        }
      };

      const normalizeTagBlocks = (rawHtml: string) => {
        try {
          if (typeof window === "undefined") return rawHtml;
          const parser = new DOMParser();
          const doc = parser.parseFromString(rawHtml, "text/html");
          const tagDivs = Array.from(
            doc.querySelectorAll("div.tag, div[class*='tag '] , div[class*=' tag']"),
          );

          for (const div of tagDivs) {
            const outerSpan = div.querySelector(":scope > span");
            if (!outerSpan) continue;

            // If there is a single inner span, merge its style into the outer span
            // and unwrap it so we always end up with exactly one span.
            const innerSpans = Array.from(
              outerSpan.querySelectorAll(":scope > span"),
            ) as HTMLElement[];
            if (innerSpans.length === 1) {
              const inner = innerSpans[0];
              const innerStyle = inner.getAttribute("style") || "";
              const outerStyle = (outerSpan as HTMLElement).getAttribute("style") || "";

              let mergedStyle = outerStyle.trim();
              if (innerStyle.trim()) {
                mergedStyle = mergedStyle
                  ? `${mergedStyle.replace(/;?\s*$/, "; ")}${innerStyle.trim()}`
                  : innerStyle.trim();
              }

              if (mergedStyle) {
                (outerSpan as HTMLElement).setAttribute("style", mergedStyle);
              }

              while (inner.firstChild) {
                outerSpan.insertBefore(inner.firstChild, inner);
              }
              outerSpan.removeChild(inner);
            }

            // Ensure the final span always has the Bricolage font-family.
            const spanEl = outerSpan as HTMLElement;
            const styleAttr = spanEl.getAttribute("style") || "";
            const hasFontFamily = /font-family\s*:/i.test(styleAttr);
            const finalStyle = hasFontFamily
              ? styleAttr
              : `${styleAttr}${
                  styleAttr.trim().endsWith(";") || styleAttr.trim() === ""
                    ? ""
                    : ";"
                } font-family: ${tagFontFamily};`;
            spanEl.setAttribute("style", finalStyle);
          }

          return doc.body.innerHTML;
        } catch {
          return rawHtml;
        }
      };

      // Normalize tag blocks to a single styled span, and lift list item inline styles
      // up to the list element for consistent rendering.
      html = normalizeTagBlocks(html);
      html = liftListTextStyles(html);
      html = wrapLegalSignsHtml(html);

      lastEmittedHtml.current = html;
      onChange(html);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none p-3 min-h-[140px]",
        style: `font-family: ${sourceSansOption.cssFamily};`,
      },
      transformPastedHTML(html) {
        // Strip editor-specific attributes that can break editing behavior,
        // but keep normal inline styles so each element can carry its own
        // font, size, color, alignment, etc. onto the frontend.
        // First strip editor-specific attributes that can break editing behavior.
        let cleaned = html
          .replace(/\scontenteditable="[^"]*"/gi, "")
          .replace(/\scontenteditable='[^']*'/gi, "")
          .replace(/\sdata-[a-z0-9_-]+="[^"]*"/gi, "")
          .replace(/\sdata-[a-z0-9_-]+='[^']*'/gi, "");

        // Normalize tag blocks and also lift list styles for pasted content so
        // lists behave like authored ones.
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(cleaned, "text/html");
          // Normalize tag blocks in pasted HTML
          const tagDivs = Array.from(
            doc.querySelectorAll("div.tag, div[class*='tag '] , div[class*=' tag']"),
          );
          for (const div of tagDivs) {
            const outerSpan = div.querySelector(":scope > span");
            if (!outerSpan) continue;
            const innerSpans = Array.from(
              outerSpan.querySelectorAll(":scope > span"),
            ) as HTMLElement[];
            if (innerSpans.length === 1) {
              const inner = innerSpans[0];
              const innerStyle = inner.getAttribute("style") || "";
              const outerStyle = (outerSpan as HTMLElement).getAttribute("style") || "";
              let mergedStyle = outerStyle.trim();
              if (innerStyle.trim()) {
                mergedStyle = mergedStyle
                  ? `${mergedStyle.replace(/;?\s*$/, "; ")}${innerStyle.trim()}`
                  : innerStyle.trim();
              }
              if (mergedStyle) {
                (outerSpan as HTMLElement).setAttribute("style", mergedStyle);
              }
              while (inner.firstChild) {
                outerSpan.insertBefore(inner.firstChild, inner);
              }
              outerSpan.removeChild(inner);
            }
            const spanEl = outerSpan as HTMLElement;
            const styleAttr = spanEl.getAttribute("style") || "";
            const hasFontFamily = /font-family\s*:/i.test(styleAttr);
            const finalStyle = hasFontFamily
              ? styleAttr
              : `${styleAttr}${
                  styleAttr.trim().endsWith(";") || styleAttr.trim() === ""
                    ? ""
                    : ";"
                } font-family: ${tagFontFamily};`;
            spanEl.setAttribute("style", finalStyle);
          }

          // Lift list styles
          const lists = Array.from(doc.querySelectorAll("ul, ol"));
          for (const list of lists) {
            const spans = Array.from(list.querySelectorAll("li span[style]"));
            if (spans.length === 0) continue;
            const style0 = (spans[0] as HTMLElement).getAttribute("style") || "";
            if (!style0.trim()) continue;
            const allSame = spans.every((s) => {
              const st = (s as HTMLElement).getAttribute("style") || "";
              return st.trim() === style0.trim();
            });
            if (!allSame) continue;
            const existing = (list as HTMLElement).getAttribute("style") || "";
            const merged =
              existing.trim().length > 0
                ? `${existing.trim().replace(/;?\s*$/, "; ")}${style0.trim()}`
                : style0.trim();
            (list as HTMLElement).setAttribute("style", merged);
            for (const span of spans) {
              const el = span as HTMLElement;
              const attrNames = Array.from(el.attributes).map((a) => a.name);
              const onlyStyle =
                attrNames.length === 1 && attrNames[0].toLowerCase() === "style";
              if (!onlyStyle) continue;
              const parent = el.parentNode;
              if (!parent) continue;
              while (el.firstChild) {
                parent.insertBefore(el.firstChild, el);
              }
              parent.removeChild(el);
            }
          }
          cleaned = doc.body.innerHTML;
        } catch {
          // ignore
        }

        return wrapLegalSignsHtml(cleaned);
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    const updateFromSelection = () => {
      // Track last selection so toolbar actions can restore it after focus loss
      try {
        const sel = editor.state.selection;
        lastSelectionRef.current = { from: sel.from, to: sel.to };
      } catch {
        // ignore
      }

      // Inline text styles (font family / size)
      const attrs = editor.getAttributes("textStyle") as {
        fontFamily?: string;
        fontSize?: string;
      };

      const activeFont = attrs.fontFamily || "";
      if (
        activeFont &&
        ((fontOptions || []).some((f) => f.cssFamily === activeFont) ||
          activeFont === sourceSansOption.cssFamily)
      ) {
        setCurrentFontFamily(activeFont);
      } else if (activeFont === tagFontFamily) {
        setCurrentFontFamily(tagFontFamily);
      } else {
        setCurrentFontFamily(sourceSansOption.cssFamily);
      }
      setCurrentFontSize(attrs.fontSize || "14px");

      // Paragraph-level line-height, stored as inline style on <p>
      const paraAttrs = editor.getAttributes("paragraph") as {
        style?: string;
      };
      let lh = "1.5";
      if (paraAttrs.style) {
        const match = paraAttrs.style.match(/line-height:\s*([^;]+);?/i);
        if (match && match[1]) {
          lh = match[1].trim();
        }
      }
      setCurrentLineHeight(lh);

      if (editor.isActive("bulletList")) {
        const attrs = editor.getAttributes("bulletList") as {
          dataListStyle?: string | null;
        };
        setCurrentListStyle(attrs.dataListStyle || "dot");
      }
    };

    editor.on("selectionUpdate", updateFromSelection);
    editor.on("transaction", updateFromSelection);
    updateFromSelection();

    return () => {
      editor.off("selectionUpdate", updateFromSelection);
      editor.off("transaction", updateFromSelection);
    };
  }, [editor, fontOptions, sourceSansOption.cssFamily]);

  useEffect(() => {
    if (!editor) return;
    // Only update editor content when the external `value` prop changed
    // from outside the editor (e.g. server data load, reset), not when
    // the change was just emitted by this editor instance.
    if (value === lastEmittedHtml.current) {
      return;
    }
    const nextValue = wrapLegalSignsHtml(value);
    if (nextValue !== editor.getHTML()) {
      editor.commands.setContent(nextValue);
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    const root = editor.view.dom as HTMLElement;
    const selector = [
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "li",
      "strong",
    ].join(",");
    const applyClass = () => {
      Array.from(root.querySelectorAll(".blockqoute2")).forEach((el) =>
        el.classList.remove("blockqoute2"),
      );
      const nodes = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
      if (!applyBlockqoute2ToLastTextElement) return;
      const candidates = nodes.filter((el) => {
        if ((el.textContent || "").trim().length === 0) return false;
        const parent = el.parentElement;
        return !parent || !parent.closest("p,h1,h2,h3,h4,h5,h6,blockquote,li,strong");
      });
      const last = candidates[candidates.length - 1];
      if (last) last.classList.add("blockqoute2");
    };
    applyClass();
    editor.on("update", applyClass);
    editor.on("selectionUpdate", applyClass);
    return () => {
      editor.off("update", applyClass);
      editor.off("selectionUpdate", applyClass);
    };
  }, [editor, applyBlockqoute2ToLastTextElement]);

  const resolvedHeight = height ?? DEFAULT_EDITOR_HEIGHT;

  return (
    <div
      className="space-y-1"
      onBlur={(e) => {
        if (!onBlur) return;
        const next = e.relatedTarget;
        if (
          next &&
          next instanceof globalThis.Node &&
          e.currentTarget.contains(next)
        )
          return;
        onBlur();
      }}
    >
      {label && (
        <label className="mb-1 block text-md font-medium text-zinc-700">
          {label}
        </label>
      )}
      <div className="overflow-hidden !rounded-md border border-zinc-300 bg-white text-sm shadow-sm blk-set">
        <div className="tiptap-toolbar relative flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-3 py-1.5">
          {/* Undo / Redo */}
          <button
            type="button"
            title="Undo"
            aria-label="Undo"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().undo()}
            className="px-1.5 py-0.5 rounded text-zinc-700 hover:bg-zinc-200 disabled:opacity-40"
          >
            ↺
          </button>
          <button
            type="button"
            title="Redo"
            aria-label="Redo"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().redo()}
            className="px-1.5 py-0.5 rounded text-zinc-700 hover:bg-zinc-200 disabled:opacity-40"
          >
            ↻
          </button>

          {/* Heading levels */}
          <select
            title="Heading level"
            aria-label="Heading level"
            className="ml-1 rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs text-zinc-700"
            value={
              editor?.isActive("heading", { level: 1 })
                ? "h1"
                : editor?.isActive("heading", { level: 2 })
                  ? "h2"
                  : editor?.isActive("heading", { level: 3 })
                    ? "h3"
                    : "p"
            }
            onChange={(e) => {
              const val = e.target.value;
              if (!editor) return;
              if (val === "p") {
                editor.chain().focus().setParagraph().run();
              } else {
                const level = Number(val.slice(1)) as 1 | 2 | 3;
                editor.chain().focus().toggleHeading({ level }).run();
              }
            }}
          >
            <option value="p">Paragraph</option>
            <option value="h1">H1</option>
            <option value="h2">H2</option>
            <option value="h3">H3</option>
          </select>

          {/* Basic marks */}
          <button
            type="button"
            title="Bold"
            aria-label="Bold"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={`px-1.5 py-0.5 rounded ${
              editor?.isActive("bold")
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            B
          </button>
          <button
            type="button"
            title="Italic"
            aria-label="Italic"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={`px-1.5 py-0.5 rounded italic ${
              editor?.isActive("italic")
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            I
          </button>
          <button
            type="button"
            title="Underline"
            aria-label="Underline"
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            className={`px-1.5 py-0.5 rounded underline ${
              editor?.isActive("underline")
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            U
          </button>

          <button
            type="button"
            title="Strikethrough"
            aria-label="Strikethrough"
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            className={`px-1.5 py-0.5 rounded line-through ${
              editor?.isActive("strike")
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            S
          </button>

          {/* Text color */}
          <div className="ml-1 inline-flex items-center gap-1">
            <input
              type="color"
              title="Text color"
              aria-label="Text color"
              className="h-5 w-5 cursor-pointer rounded border border-zinc-300 bg-white"
              value={toHex6(editor?.getAttributes("textStyle").color as string)}
              onMouseDown={() => {
                // snapshot before picker steals focus
                const sel = editor?.state.selection;
                if (sel) lastSelectionRef.current = { from: sel.from, to: sel.to };
              }}
              onChange={(e) => {
                const hex = toHex6(e.target.value);
                const sel = lastSelectionRef.current;
                const chain = editor?.chain();
                if (!chain) return;
                if (sel) {
                  chain.setTextSelection(sel);
                }
                chain.setColor(hex).run();
              }}
            />
            <input
              type="text"
              value={toHex6(editor?.getAttributes("textStyle").color as string)}
              readOnly
              className="h-6 w-[86px] !rounded-md border border-zinc-300 bg-white px-1 text-[11px] text-zinc-700 shadow-sm"
              title="Hex color (copy)"
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>

          {/* Highlight */}
          <button
            type="button"
            title="Highlight"
            aria-label="Highlight"
            onClick={() =>
              editor?.chain().focus().toggleHighlight().run()
            }
            className={`px-1.5 py-0.5 rounded ${
              editor?.isActive("highlight")
                ? "bg-yellow-300 text-zinc-900"
                : "text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            HL
          </button>

          {/* Link (single icon button with dialog) */}
          <button
            type="button"
            title="Add or edit hyperlink"
            aria-label="Add or edit hyperlink"
            onMouseDown={() => {
              const sel = editor?.state.selection;
              if (sel) lastSelectionRef.current = { from: sel.from, to: sel.to };
            }}
            onClick={() => {
              if (!editor) return;
              const currentHref = (
                editor.getAttributes("link") as { href?: string }
              ).href;
              setLinkDraft(currentHref || "https://");
              setLinkError(null);
              setShowLinkDialog(true);
            }}
            className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded ${
              editor?.isActive("link")
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>

          {/* Symbols */}
          <button
            type="button"
            title="Insert copyright (©)"
            aria-label="Insert copyright (©)"
            onClick={() => editor?.chain().focus().insertContent("©").run()}
            className="px-1.5 py-0.5 rounded text-zinc-700 hover:bg-zinc-200"
          >
            ©
          </button>
          <button
            type="button"
            title="Insert trademark (™)"
            aria-label="Insert trademark (™)"
            onClick={() => editor?.chain().focus().insertContent("™").run()}
            className="px-1.5 py-0.5 rounded text-zinc-700 hover:bg-zinc-200"
          >
            ™
          </button>
          <button
            type="button"
            title="Insert registered trademark (®)"
            aria-label="Insert registered trademark (®)"
            onClick={() => editor?.chain().focus().insertContent("®").run()}
            className="px-1.5 py-0.5 rounded text-zinc-700 hover:bg-zinc-200"
          >
            ®
          </button>
          <select
            title="Insert general icon"
            aria-label="Insert general icon"
            defaultValue=""
            className="ml-1 rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs text-zinc-700"
            onChange={(e) => {
              const icon = e.target.value;
              if (!icon) return;
              insertGeneralIcon(icon);
              e.target.value = "";
            }}
          >
            <option value="">Insert icon</option>
            <option value="→">Arrow Right (→)</option>
            <option value="←">Arrow Left (←)</option>
            <option value="↗">Arrow Up-Right (↗)</option>
            <option value="•">Dot (•)</option>
            <option value="◦">Circle Hollow (◦)</option>
            <option value="■">Square (■)</option>
            <option value="★">Star (★)</option>
            <option value="✓">Check (✓)</option>
            <option value="+">Plus (+)</option>
            <option value="◆">Diamond (◆)</option>
            <option value="▶">Triangle (▶)</option>
            <option value="›">Chevron (›)</option>
            <option value="✦">Sparkle (✦)</option>
            <option value="✉">Mail (✉)</option>
            <option value="☎">Phone (☎)</option>
            <option value="📍">Pin (📍)</option>
          </select>

          {/* Alignment */}
          <div className="ml-1 inline-flex rounded border border-zinc-300 bg-white">
            <button
              type="button"
              title="Align left"
              aria-label="Align left"
              onClick={() =>
                editor?.chain().focus().setTextAlign("left").run()
              }
              className={`px-1.5 py-0.5 text-[10px] ${
                editor?.isActive({ textAlign: "left" })
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              L
            </button>
            <button
              type="button"
              title="Align center"
              aria-label="Align center"
              onClick={() =>
                editor?.chain().focus().setTextAlign("center").run()
              }
              className={`px-1.5 py-0.5 text-[10px] ${
                editor?.isActive({ textAlign: "center" })
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              C
            </button>
            <button
              type="button"
              title="Align right"
              aria-label="Align right"
              onClick={() =>
                editor?.chain().focus().setTextAlign("right").run()
              }
              className={`px-1.5 py-0.5 text-[10px] ${
                editor?.isActive({ textAlign: "right" })
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              R
            </button>
          </div>

          {/* Font family */}
          <select
            title="Font family"
            aria-label="Font family"
            className="ml-1 rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs text-zinc-700"
            value={currentFontFamily}
            onChange={(e) => {
              const val = e.target.value;
              if (!editor) return;
              editor.chain().focus().setFontFamily(val).run();
              setCurrentFontFamily(val);
            }}
          >
            {mergedFontOptions.map((font) => (
              <option key={`${font.label}-${font.cssFamily}`} value={font.cssFamily}>
                {font.label}
              </option>
            ))}
          </select>

          {/* Font size */}
          <select
            title="Font size"
            aria-label="Font size"
            className="ml-1 rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs text-zinc-700"
            value={currentFontSize}
            onChange={(e) => {
              const val = e.target.value;
              if (!editor) return;
              editor.chain().focus().setFontSize(val).run();
              setCurrentFontSize(val);
            }}
          >
            <option value="10px">10</option>
            <option value="12px">12</option>
            <option value="14px">14</option>
            <option value="16px">16</option>
            <option value="18px">18</option>
            <option value="20px">20</option>
            <option value="24px">24</option>
            <option value="28px">28</option>
            <option value="32px">32</option>
            <option value="36px">36</option>
            <option value="42px">42</option>
            <option value="48px">48</option>
          </select>

          {/* Line height */}
          <select
            title="Line height"
            aria-label="Line height"
            className="ml-1 rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs text-zinc-700"
            value={currentLineHeight}
            onChange={(e) => {
              const val = e.target.value;
              if (!editor) return;

              // Merge with existing paragraph style so we keep text-align, etc.
              const paraAttrs = editor.getAttributes("paragraph") as {
                style?: string;
              };
              let style = paraAttrs.style || "";

              // Remove any existing line-height from the style string
              style = style.replace(/line-height:\s*[^;]+;?/gi, "").trim();

              if (style && !style.endsWith(";")) {
                style += ";";
              }

              if (style) {
                style += " ";
              }

              style += `line-height: ${val};`;

              editor
                .chain()
                .focus()
                .setParagraph()
                .updateAttributes("paragraph", { style })
                .run();

              setCurrentLineHeight(val);
            }}
          >
            <option value="1">1</option>
            <option value="1.15">1.15</option>
            <option value="1.3">1.3</option>
            <option value="1.5">1.5</option>
            <option value="1.75">1.75</option>
            <option value="2">2</option>
            <option value="2.5">2.5</option>
            <option value="3">3</option>
          </select>

          {/* Lists */}
          <select
            title="List style"
            aria-label="List style"
            className="ml-1 rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs text-zinc-700"
            value={currentListStyle}
            onChange={(e) => applyListStyle(e.target.value)}
          >
            <option value="dot">List: Dot</option>
            <option value="circle">List: Circle</option>
            <option value="square">List: Square</option>
            <option value="tick">List: Tick</option>
            <option value="arrow">List: Arrow</option>
            <option value="dash">List: Dash</option>
            <option value="plus">List: Plus</option>
            <option value="star">List: Star</option>
            <option value="diamond">List: Diamond</option>
            <option value="triangle">List: Triangle</option>
            <option value="chevron">List: Chevron</option>
            <option value="sparkle">List: Sparkle</option>
            <option value="pin">List: Pin</option>
            <option value="none">List: No marker</option>
          </select>
          <button
            type="button"
            title="Insert 2 equal columns (50/50)"
            aria-label="Insert 2 equal columns (50/50)"
            onClick={insertTwoColumnTemplate}
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-zinc-700 hover:bg-zinc-200"
          >
            <Columns2 className="h-3.5 w-3.5" />
          </button>

          {/* Indent / Outdent for list items */}
          <button
            type="button"
            title="Indent list item"
            aria-label="Indent list item"
            onClick={() =>
              editor?.chain().focus().sinkListItem("listItem").run()
            }
            className="px-1.5 py-0.5 rounded text-zinc-700 hover:bg-zinc-200"
          >
            ➜
          </button>
          <button
            type="button"
            title="Outdent list item"
            aria-label="Outdent list item"
            onClick={() =>
              editor?.chain().focus().liftListItem("listItem").run()
            }
            className="px-1.5 py-0.5 rounded text-zinc-700 hover:bg-zinc-200"
          >
            ⬅
          </button>

          {/* Block quote */}
          <button
            type="button"
            title="Blockquote"
            aria-label="Blockquote"
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            className={`px-1.5 py-0.5 rounded ${
              editor?.isActive("blockquote")
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            “”
          </button>

          {/* Tag block: wrap selection in <div class="tag"> */}
          <button
            type="button"
            title="Tag block"
            aria-label="Tag block"
            onClick={() => {
              if (!editor) return;
              // Avoid runtime error if for some reason the node is missing
              if (!editor.schema.nodes["tagBlock"]) return;
              const isActive = editor.isActive("tagBlock");
              const chain = editor.chain().focus();

              if (isActive) {
                // Just remove the tag block, leave font family as-is
                chain.toggleNode("tagBlock", "paragraph").run();
              } else {
                // When creating a tag, also apply the Bricolage Grotesque font
                // to the current selection / stored marks so existing or newly
                // typed text uses the correct font.
                chain
                  .toggleNode("tagBlock", "paragraph")
                  .setFontFamily(tagFontFamily)
                  .run();
                setCurrentFontFamily(tagFontFamily);
              }
            }}
            className={`px-1.5 py-0.5 rounded ${
              editor?.isActive("tagBlock")
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            Tag
          </button>
          {toolbarActions.map((action) => (
            <button
              key={action.id}
              type="button"
              title={action.title ?? action.label}
              aria-label={action.title ?? action.label}
              onClick={action.onClick}
              className={`px-1.5 py-0.5 rounded ${
                action.active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {action.label}
            </button>
          ))}

          {/* Clear formatting */}
          <button
            type="button"
            title="Clear formatting"
            aria-label="Clear formatting"
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .clearNodes()
                .unsetAllMarks()
                .run()
            }
            className="ml-1 px-1.5 py-0.5 rounded text-zinc-700 hover:bg-zinc-200"
          >
            Clear
          </button>
          {showLinkDialog && (
            <div className="absolute left-2 top-[calc(100%+6px)] z-20 w-[320px] !rounded-md border border-zinc-200 bg-white p-3 shadow-lg">
              <p className="mb-2 text-xs font-medium text-zinc-700">
                Hyperlink
              </p>
              <input
                type="text"
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                placeholder="https://example.com"
                className="w-full !rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
              {linkError && (
                <p className="mt-1 text-[11px] text-red-600">{linkError}</p>
              )}
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={removeLinkFromDialog}
                  className="!rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Remove link
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLinkError(null);
                      setShowLinkDialog(false);
                    }}
                    className="!rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={applyLinkFromDialog}
                    className="!rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div
          style={{ minHeight: resolvedHeight }}
          className={`bg-white text-sm ${editorClassName ?? ""}`}
        >
          {editor && <EditorContent editor={editor} />}
          {!editor && (
            <div className="p-3 text-xs text-zinc-400">Loading editor…</div>
          )}
        </div>
      </div>
    </div>
  );
}


