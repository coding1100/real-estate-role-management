"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HexAlphaColorPicker } from "react-colorful";

export interface HexAlphaColorFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  fallback?: string; // used for swatch/picker when value is empty/invalid
  disabled?: boolean;
  className?: string;
  swatchClassName?: string;
  inputClassName?: string;
  showInput?: boolean;
  popoverWidthClassName?: string; // e.g. "w-[240px]"
  label?: string; // optional label inside popover
}

function isHexOnlyColor(value: string) {
  return /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim());
}

function normalizeWhileTyping(value: string) {
  const v = value.trim();
  if (v.length === 0) return "";
  if (isHexOnlyColor(v)) return v.toLowerCase();
  return value;
}

function getPickerColor(value: string, fallback: string) {
  return isHexOnlyColor(value) ? value.toLowerCase() : fallback;
}

export function HexAlphaColorField({
  value,
  onChange,
  placeholder = "#000000ff",
  fallback = "#000000ff",
  disabled,
  className,
  swatchClassName,
  inputClassName,
  showInput = true,
  popoverWidthClassName = "w-[240px]",
  label,
}: HexAlphaColorFieldProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const pickerColor = useMemo(
    () => getPickerColor(value, fallback),
    [value, fallback],
  );

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const el = containerRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={className ? className : "relative flex items-center gap-2"}
    >
      <button
        type="button"
        disabled={disabled}
        className={
          swatchClassName
            ? swatchClassName
            : "h-9 w-9 !rounded-md border border-zinc-300 bg-white shadow-sm disabled:opacity-60"
        }
        onClick={() => setOpen((v) => !v)}
        title="Pick color (hex with alpha)"
        style={{ background: pickerColor }}
      />

      {showInput && (
        <input
          type="text"
          disabled={disabled}
          className={
            inputClassName
              ? inputClassName
              : "h-9 flex-1 !rounded-md border border-zinc-300 px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-60"
          }
          value={normalizeWhileTyping(value)}
          onChange={(e) => onChange(normalizeWhileTyping(e.target.value))}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next.length === 0) return;
            if (isHexOnlyColor(next)) {
              onChange(next.toLowerCase());
            }
          }}
          placeholder={placeholder}
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
        />
      )}

      {open && (
        <div
          className={`absolute left-0 top-11 z-50 ${popoverWidthClassName} !rounded-md border border-zinc-200 bg-white p-3 shadow-lg`}
        >
          {label && (
            <div className="text-[11px] font-medium text-zinc-600">{label}</div>
          )}
          <div className={label ? "mt-2" : ""}>
            <HexAlphaColorPicker
              color={pickerColor}
              onChange={(hex) => onChange(hex.toLowerCase())}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="text-[11px] text-zinc-600 hover:text-zinc-900"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="text-[11px] text-zinc-600 hover:text-zinc-900"
              onClick={() => onChange("")}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

