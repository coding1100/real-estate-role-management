"use client";

import { useNode } from "@craftjs/core";
import type { ReactNode } from "react";

interface SectionBlockCardProps {
  label: string;
  children?: ReactNode;
}

export function SectionBlockCard({ label, children }: SectionBlockCardProps) {
  const {
    connectors: { connect, drag },
  } = useNode();

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref));
      }}
      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
    >
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </div>
  );
}
