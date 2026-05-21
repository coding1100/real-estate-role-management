"use client";

import React, { useState, useCallback, useEffect } from "react";
import GridLayout from "react-grid-layout";
import type { LandingPageContent } from "@/lib/types/page";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

interface LayoutItem {
  x: number;
  y: number;
  w: number;
  h: number;
  i: string;
  minW?: number;
  minH?: number;
  static?: boolean;
  hidden?: boolean;
}

interface LayoutSettings {
  textContainerLayout: LayoutItem;
  formContainerLayout: LayoutItem;
}

const HEADER_ROW = 0;
const HEADER_H = 1;
const CONTENT_ROW_START = 1;
const FOOTER_ROW = 7;
const FOOTER_H = 1;
const ROW_HEIGHT_PX = 42;

function defaultHeader(): LayoutItem {
  return {
    x: 0,
    y: HEADER_ROW,
    w: 12,
    h: HEADER_H,
    i: "header-bar",
    static: true,
  };
}
function defaultFooter(): LayoutItem {
  return {
    x: 0,
    y: FOOTER_ROW,
    w: 12,
    h: FOOTER_H,
    i: "footer-bar",
    static: true,
  };
}

interface DragDropPageLayoutEditorProps {
  page: LandingPageContent;
  onLayoutChange?: (layout: LayoutSettings) => void;
  onReady?: (getLayout: () => LayoutItem[]) => void;
  initialLayout?: {
    header?: LayoutItem;
    text?: LayoutItem;
    form?: LayoutItem;
    footer?: LayoutItem;
  };
}

export function DragDropPageLayoutEditor({
  page,
  onLayoutChange,
  onReady,
  initialLayout,
}: DragDropPageLayoutEditorProps) {
  const defaultText: LayoutItem = {
    x: 0,
    y: CONTENT_ROW_START,
    w: 8,
    h: 5,
    i: "text-container",
    minW: 4,
    minH: 3,
    static: false,
  };
  const defaultForm: LayoutItem = {
    x: 8,
    y: CONTENT_ROW_START,
    w: 4,
    h: 5,
    i: "form-container",
    minW: 4,
    minH: 3,
    static: false,
  };

  const defaultLayout: LayoutItem[] = [
    defaultHeader(),
    defaultFooter(),
    defaultText,
    defaultForm,
  ];

  function buildInitialLayout(): LayoutItem[] {
    const data = page.pageLayout?.layoutData as LayoutItem[] | undefined;
    if (!Array.isArray(data) || data.length === 0) {
      if (initialLayout?.text && initialLayout?.form) {
        const header = { ...(initialLayout.header ?? defaultHeader()), hidden: (initialLayout.header as LayoutItem)?.hidden ?? false };
        const footer = { ...(initialLayout.footer ?? defaultFooter()), hidden: (initialLayout.footer as LayoutItem)?.hidden ?? false };
        const text = { ...initialLayout.text, hidden: (initialLayout.text as LayoutItem)?.hidden ?? false };
        const form = { ...initialLayout.form, hidden: (initialLayout.form as LayoutItem)?.hidden ?? false };
        return [header, footer, text, form];
      }
      return defaultLayout;
    }
    const withHidden = (item: LayoutItem, def: LayoutItem) => ({
      ...def,
      ...item,
      hidden: item.hidden ?? false,
    });
    const header = withHidden(
      data.find((l) => l.i === "header-bar") ?? defaultHeader(),
      defaultHeader()
    );
    const footer = withHidden(
      data.find((l) => l.i === "footer-bar") ?? defaultFooter(),
      defaultFooter()
    );
    const text = withHidden(
      data.find((l) => l.i === "text-container") ?? defaultText,
      defaultText
    );
    const form = withHidden(
      data.find((l) => l.i === "form-container") ?? defaultForm,
      defaultForm
    );
    return [header, footer, text, form];
  }

  const [layout, setLayout] = useState<LayoutItem[]>(buildInitialLayout);

  const isVisible = useCallback(
    (id: string) => layout.find((l) => l.i === id)?.hidden !== true,
    [layout]
  );

  const toggleVisible = useCallback((id: string) => {
    setLayout((prev) =>
      prev.map((item) =>
        item.i === id ? { ...item, hidden: !item.hidden } : item
      )
    );
  }, []);

  const handleLayoutChange = useCallback(
    (newLayout: any[]) => {
      const header = newLayout.find((l) => l.i === "header-bar") ?? defaultHeader();
      const footer = newLayout.find((l) => l.i === "footer-bar") ?? defaultFooter();
      const text = newLayout.find((l) => l.i === "text-container");
      const form = newLayout.find((l) => l.i === "form-container");
      const normalized = [
        { ...header, x: 0, y: HEADER_ROW, w: 12, h: HEADER_H, static: true, hidden: header.hidden },
        { ...footer, x: 0, y: FOOTER_ROW, w: 12, h: FOOTER_H, static: true, hidden: footer.hidden },
        ...(text ? [{ ...text, hidden: text.hidden }] : []),
        ...(form ? [{ ...form, hidden: form.hidden }] : []),
      ];
      setLayout(normalized);
      if (text && form) {
        onLayoutChange?.({
          textContainerLayout: text,
          formContainerLayout: form,
        });
      }
    },
    [onLayoutChange]
  );

  React.useEffect(() => {
    onReady?.(() => layout);
  }, [layout, onReady]);

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div className="flex gap-3">
          <div className="flex-shrink-0 text-blue-600 text-lg">💡</div>
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Layout Instructions</p>
            <ul className="space-y-1 text-md list-disc list-inside">
              <li>Drag containers to swap positions (left ↔ right)</li>
              <li>Resize from the bottom-right corner to change width/height</li>
              <li>Minimum width: 33% (4 columns) - can create 3-column or 2-column layouts</li>
              <li>Resize to stack them vertically as needed</li>
              <li>Boxed styling with responsive grid layout</li>
              <li>✔ Layout changes are automatically saved when you click Save/Publish</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Grid Layout Container */}
      <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm max-[768px]:overflow-x-auto">
        <GridLayout
          className="grid-layout-editor"
          layout={layout as any}
          onLayoutChange={handleLayoutChange as any}
          width={1000}
          {...({ margin: [6, 4], containerPadding: [0, 0], rowHeight: ROW_HEIGHT_PX } as any)}
        >
          {/* Header bar - fixed, full width */}
          <div
            key="header-bar"
            className={`rounded-t-lg border-2 border-zinc-300 bg-zinc-800 text-white overflow-hidden flex items-center justify-between max-h-[100px] min-h-0 px-3 ${!isVisible("header-bar") ? "opacity-70" : ""}`}
          >
            <div className="flex items-center gap-2 py-2">
              <span className="text-lg">📌</span>
              <span className="text-sm font-bold uppercase tracking-wide">
                Header Bar
              </span>
            </div>
            <label className="flex items-center gap-2 text-md font-semibold cursor-pointer select-none shrink-0" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isVisible("header-bar")}
                onChange={() => toggleVisible("header-bar")}
                className="rounded border-zinc-400"
              />
              Show on page
            </label>
          </div>

          {/* Footer bar - fixed, full width */}
          <div
            key="footer-bar"
            className={`rounded-b-lg border-2 border-zinc-300 bg-zinc-700 text-white overflow-hidden flex items-center justify-between max-h-[100px] min-h-0 px-3 ${!isVisible("footer-bar") ? "opacity-70" : ""}`}
          >
            <div className="flex items-center gap-2 py-2">
              <span className="text-lg">📌</span>
              <span className="text-sm font-bold uppercase tracking-wide">
                Footer Bar
              </span>
            </div>
            <label className="flex items-center gap-2 text-md font-semibold cursor-pointer select-none shrink-0" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isVisible("footer-bar")}
                onChange={() => toggleVisible("footer-bar")}
                className="rounded border-zinc-400"
              />
              Show on page
            </label>
          </div>

          {/* Text Container */}
          <div
            key="text-container"
            className={`rounded-lg border-2 border-zinc-300 bg-zinc-50 shadow-md overflow-hidden flex flex-col hover:shadow-lg transition-shadow ${!isVisible("text-container") ? "opacity-70" : ""}`}
          >
            <div className="flex items-center justify-between border-b border-zinc-300 bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 cursor-move hover:from-blue-600 hover:to-blue-700 transition-colors select-none group">
              <div className="flex items-center gap-2">
                <span className="text-white text-xl group-hover:scale-110 transition-transform">
                  📝
                </span>
                <h3 className="text-sm font-bold text-white">
                  Text Container
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-md font-medium text-white/90 cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isVisible("text-container")}
                    onChange={() => toggleVisible("text-container")}
                    className="rounded border-white/50"
                  />
                  Show on page
                </label>
                <span className="text-white text-lg opacity-60 group-hover:opacity-100">⋮⋮</span>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-4 overflow-auto">
              <div className="space-y-3 text-md text-zinc-600">
                <p className="font-semibold text-zinc-900">
                  Left Column Content
                </p>
                <div className="space-y-2">
                  <div className="h-2 bg-blue-200 rounded w-3/4"></div>
                  <div className="h-2 bg-blue-200 rounded"></div>
                  <div className="h-2 bg-blue-200 rounded w-5/6"></div>
                </div>
                <p className="text-zinc-500 italic mt-4">
                  Hero left: main card (rich text)
                </p>
                <p className="text-zinc-500 italic">
                  Form intro text (right column)
                </p>
              </div>
            </div>

            {/* Resize Handle Indicator */}
            <div className="text-center border-t border-zinc-300 bg-zinc-100 px-2 py-1">
              <span className="text-md text-zinc-500">Drag corner to resize →</span>
            </div>
          </div>

          {/* Form Container */}
          <div
            key="form-container"
            className={`rounded-lg border-2 border-zinc-300 bg-green-50 shadow-md overflow-hidden flex flex-col hover:shadow-lg transition-shadow ${!isVisible("form-container") ? "opacity-70" : ""}`}
          >
            <div className="flex items-center justify-between border-b border-zinc-300 bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 cursor-move hover:from-emerald-600 hover:to-emerald-700 transition-colors select-none group">
              <div className="flex items-center gap-2">
                <span className="text-white text-xl group-hover:scale-110 transition-transform">
                  📋
                </span>
                <h3 className="text-sm font-bold text-white">
                  Form Container
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-md font-medium text-white/90 cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isVisible("form-container")}
                    onChange={() => toggleVisible("form-container")}
                    className="rounded border-white/50"
                  />
                  Show on page
                </label>
                <span className="text-white text-lg opacity-60 group-hover:opacity-100">⋮⋮</span>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-4 overflow-auto">
              <div className="space-y-3 text-md text-zinc-600">
                <p className="font-semibold text-zinc-900">
                  Right Column Content
                </p>
                <div className="space-y-2">
                  <div className="h-2 bg-emerald-200 rounded w-3/4"></div>
                  <div className="h-2 bg-emerald-200 rounded"></div>
                  <div className="h-2 bg-emerald-200 rounded w-5/6"></div>
                </div>
                <p className="text-zinc-500 italic mt-4">
                  Form heading (rich text)
                </p>
                <p className="text-zinc-500 italic">
                  Form fields and CTA button
                </p>
              </div>
            </div>

            {/* Resize Handle Indicator */}
            <div className="text-center border-t border-zinc-300 bg-green-100 px-2 py-1">
              <span className="text-md text-zinc-500">Drag corner to resize →</span>
            </div>
          </div>
        </GridLayout>
      </div>

      {/* Current Layout Info */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 mt-3">
        <p className="text-md font-semibold text-zinc-700 mb-2 uppercase tracking-wide">
          📍 Current Layout Configuration
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {layout.map((item) => (
            <div
              key={item.i}
              className="!rounded-md border border-zinc-300 bg-white p-3"
            >
              <p className="text-md font-bold text-zinc-900 capitalize mb-2">
                {item.i.replace(/-/g, " ")}
                {item.hidden && <span className="ml-1 text-amber-600 font-normal">(hidden)</span>}
              </p>
              <div className="grid grid-cols-2 gap-2 text-md text-zinc-600">
                <div>
                  <span className="text-zinc-700 font-medium">Position:</span>
                  <p className="text-zinc-500">
                    Col {item.x + 1}, Row {item.y + 1}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-700 font-medium">Size:</span>
                  <p className="text-zinc-500">
                    {item.w} cols × {item.h} rows
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CSS Styles */}
      <style jsx global>{`
        .grid-layout-editor {
          position: relative;
          transition: height 200ms ease;
        }

        .grid-layout-editor .react-grid-layout {
          position: relative;
        }

        .grid-layout-editor .react-grid-item {
          position: absolute;
          transition: all 200ms ease;
          border-radius: 8px;
          touch-action: none;
        }

        .react-grid-item.react-grid-placeholder {
          background: #3498db;
          opacity: 0.3;
          border-radius: 6px;
          z-index: 2;
          border: 2px dashed #3498db;
        }

        .react-draggable-dragging {
          z-index: 3;
          will-change: transform;
        }

        .react-grid-item > .react-resizable-handle {
          position: absolute;
          width: 24px;
          height: 24px;
          bottom: 0;
          right: 0;
          cursor: se-resize;
          background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="%23999" d="M20 20h-2v-2h2v2zm-4-2h2v2h-2v-2zm2-4h2v2h-2v-2z"/></svg>') no-repeat;
          background-position: bottom right;
          padding: 0 8px 8px 0;
          background-repeat: no-repeat;
          background-origin: content-box;
          box-sizing: border-box;
          touch-action: none;
        }

        .react-grid-item > .react-resizable-handle-sw {
          bottom: 0;
          left: 0;
          cursor: sw-resize;
          transform: rotate(90deg);
        }

        .react-grid-item > .react-resizable-handle-se {
          bottom: 0;
          right: 0;
          cursor: se-resize;
        }

        .react-grid-item > .react-resizable-handle-nw {
          top: 0;
          left: 0;
          cursor: nw-resize;
          transform: rotate(180deg);
        }

        .react-grid-item > .react-resizable-handle-ne {
          top: 0;
          right: 0;
          cursor: ne-resize;
          transform: rotate(270deg);
        }

        .react-grid-item > .react-resizable-handle-w,
        .react-grid-item > .react-resizable-handle-e {
          cursor: ew-resize;
        }

        .react-grid-item > .react-resizable-handle-n,
        .react-grid-item > .react-resizable-handle-s {
          cursor: ns-resize;
        }
      `}</style>
    </div>
  );
}
