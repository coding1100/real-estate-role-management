"use client";

import { useNode } from "@craftjs/core";
import type { ReactNode } from "react";
import { Eye, EyeOff, GripVertical, MoveVertical } from "lucide-react";

interface BlockCardProps {
  label: string;
  description?: string;
  icon?: ReactNode;
}

export function BlockCard({ label, description, icon }: BlockCardProps) {
  const {
    connectors: { connect, drag },
    actions: { setProp },
    props: nodeProps,
  } = useNode((node) => ({
    props: node.data.props,
  }));

  const hidden = (nodeProps as { hidden?: boolean }).hidden === true;
  const size = (nodeProps as { size?: "sm" | "md" | "lg" }).size || "md";

  const sizeClass =
    size === "sm" ? "py-2" : size === "lg" ? "py-5" : "py-3.5";

  const toggleVisible = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setProp((p: Record<string, unknown>) => {
      p.hidden = !p.hidden;
    });
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    let currentSize = size;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY;
      if (delta > 30 && currentSize !== "lg") {
        currentSize = "lg";
        setProp((p: Record<string, unknown>) => {
          p.size = "lg";
        });
      } else if (delta < -30 && currentSize !== "sm") {
        currentSize = "sm";
        setProp((p: Record<string, unknown>) => {
          p.size = "sm";
        });
      } else if (delta > -10 && delta < 10 && currentSize !== "md") {
        currentSize = "md";
        setProp((p: Record<string, unknown>) => {
          p.size = "md";
        });
      }
    };

    const stop = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", stop);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stop);
  };

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref));
      }}
      className={`group relative flex items-start gap-3 rounded-xl border bg-white px-4 text-left text-md shadow-sm transition-colors ${
        hidden
          ? "border-amber-200 bg-amber-50/70 opacity-80"
          : "border-zinc-200 group-hover:border-zinc-300"
      } ${sizeClass}`}
    >
      <div className="mt-0.5 flex shrink-0 items-center">
        <span className="inline-flex h-6 w-6 items-center justify-center !rounded-md bg-zinc-100 text-zinc-400 group-hover:bg-zinc-200">
          <GripVertical className="h-3 w-3" />
        </span>
      </div>
      {icon && <div className="mt-0.5 text-zinc-500">{icon}</div>}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-medium text-zinc-800">{label}</p>
        {description && (
          <p className="text-[14px] leading-snug text-zinc-500">
            {description}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={toggleVisible}
          title={hidden ? "Show on page" : "Hide on page"}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          {hidden ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onMouseDown={startResize}
          title="Drag up/down to change height"
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <MoveVertical className="h-3 w-3" />
          <span className="uppercase tracking-[0.12em]">Resize</span>
        </button>
      </div>
    </div>
  );
}


