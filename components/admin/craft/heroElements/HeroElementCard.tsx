"use client";

import { useNode } from "@craftjs/core";
import { Eye, EyeOff } from "lucide-react";

interface HeroElementCardProps {
  label: string;
  children?: React.ReactNode;
}

export function HeroElementCard({ label, children }: HeroElementCardProps) {
  const {
    connectors: { connect, drag },
    actions: { setProp },
    props: nodeProps,
  } = useNode((node) => ({
    props: node.data.props,
  }));

  const hidden = (nodeProps as { hidden?: boolean }).hidden === true;

  const toggleVisible = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setProp((p: Record<string, unknown>) => {
      p.hidden = !p.hidden;
    });
  };

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref));
      }}
      className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-md shadow-sm ${
        hidden
          ? "border-amber-200 bg-amber-50/50 opacity-80"
          : "border-zinc-200"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-zinc-800">{label}</p>
        {children}
      </div>
      <button
        type="button"
        onClick={toggleVisible}
        title={hidden ? "Show on page" : "Hide on page"}
        className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
      >
        {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
