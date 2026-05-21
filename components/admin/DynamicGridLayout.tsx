"use client";

import React, { useState, useCallback } from "react";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export interface GridLayoutItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface DynamicGridLayoutProps {
  items: GridLayoutItem[];
  onLayoutChange?: (layout: any[]) => void;
  className?: string;
}

export function DynamicGridLayout({
  items,
  onLayoutChange,
  className = "",
}: DynamicGridLayoutProps) {
  const defaultLayout: any[] = items.map((item, index) => ({
    x: (index % 2) * 6,
    y: Math.floor(index / 2) * 4,
    w: 6,
    h: 4,
    i: item.id,
    minW: 6,
    minH: 2,
    static: false,
  }));

  const [layout, setLayout] = useState<any[]>(defaultLayout);

  const handleLayoutChange = useCallback(
    (newLayout: any[]) => {
      setLayout(newLayout);
      onLayoutChange?.(newLayout);
    },
    [onLayoutChange]
  );

  const itemsMap = new Map(items.map((item) => [item.id, item]));

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
        <p className="mb-4 text-md font-medium text-zinc-600">
          📍 Drag to reposition • ↗ Resize from bottom-right corner • Min width: 50% (6 cols)
        </p>
        
        <GridLayout
          className="grid-layout-container"
          layout={layout}
          onLayoutChange={handleLayoutChange as any}
          width={1200}
          {...({ margin: [12, 12], containerPadding: [0, 0] } as any)}
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border-2 border-zinc-300 bg-white shadow-sm overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3 cursor-move hover:bg-zinc-100 transition-colors">
                <h3 className="text-sm font-semibold text-zinc-900">
                  {item.label}
                </h3>
                <div className="text-md text-zinc-500 select-none">
                  ⋮⋮
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-4">
                {item.content}
              </div>
            </div>
          ))}
        </GridLayout>
      </div>

      {/* Layout Info */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-md font-medium text-zinc-600 mb-2">Current Layout:</p>
        <div className="grid grid-cols-2 gap-2 text-md text-zinc-600">
          {layout.map((item) => (
            <div key={item.i} className="rounded bg-white p-2 border border-zinc-200">
              <p className="font-medium">{itemsMap.get(item.i)?.label}</p>
              <p className="text-zinc-500">
                Col: {item.x + 1}-{item.x + item.w} | Row: {item.y + 1}-{item.y + item.h}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Custom CSS for grid layout */}
      <style jsx global>{`
        .grid-layout-container {
          background: white;
          border-radius: 8px;
        }

        .react-grid-layout {
          position: relative;
          transition: height 200ms ease;
        }

        .react-grid-item {
          position: absolute;
          transition: all 200ms ease;
          border-radius: 6px;
          touch-action: none;
        }

        .react-grid-item img {
          pointer-events: none;
          user-select: none;
        }

        .react-grid-item.static {
          background: #cce;
          opacity: 0.2;
        }

        .react-grid-item .resizing {
          opacity: 0.9;
        }

        .react-grid-item .text {
          font-size: 24px;
          text-align: center;
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          right: 0;
          margin: auto;
          height: 100%;
          width: 100%;
        }

        .react-grid-item .minMax {
          font-size: 12px;
        }

        .react-grid-item .add {
          cursor: pointer;
        }

        .react-draggable-dragging {
          opacity: 0.3;
          z-index: 3;
        }

        .react-grid-placeholder {
          background: #3498db;
          opacity: 0.2;
          border-radius: 6px;
          z-index: 2;
          border: 2px dashed #3498db;
        }

        .react-grid-item > .react-resizable-handle {
          position: absolute;
          width: 20px;
          height: 20px;
          background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTggMThIMTZWMTZIMThWMThaTTEzIDEzSDExVjExSDEzVjEzWiIgZmlsbD0iIzk0YTNiOCIvPjwvc3ZnPg==') no-repeat center;
          background-size: cover;
        }

        .react-grid-item > .react-resizable-handle::after {
          content: "";
          position: absolute;
          right: 3px;
          bottom: 3px;
          width: 5px;
          height: 5px;
          border-right: 2px solid #bdc3c7;
          border-bottom: 2px solid #bdc3c7;
        }
      `}</style>
    </div>
  );
}
