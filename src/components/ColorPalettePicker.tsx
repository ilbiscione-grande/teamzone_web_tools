"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_COLOR_PALETTE = [
  "#ffffff",
  "#f2f1e9",
  "#111111",
  "#0f1b1a",
  "#e24a3b",
  "#f06d4f",
  "#f9bf4a",
  "#ffd166",
  "#8bc34a",
  "#1f9d55",
  "#2ec4b6",
  "#2f6cf6",
  "#6a4cff",
  "#b5179e",
  "#ff7aa2",
] as const;

const normalizeHexColor = (value: string) => {
  const next = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(next)) {
    return `#${next[1]}${next[1]}${next[2]}${next[2]}${next[3]}${next[3]}`;
  }
  if (/^#[0-9a-f]{6}$/.test(next)) {
    return next;
  }
  return null;
};

type ColorPalettePickerProps = {
  value: string;
  onChange: (value: string) => void;
  title?: string;
  disabled?: boolean;
  allowTransparent?: boolean;
  className?: string;
  colors?: string[];
};

export default function ColorPalettePicker({
  value,
  onChange,
  title,
  disabled,
  allowTransparent,
  className,
  colors,
}: ColorPalettePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const normalizedValue = normalizeHexColor(value);
  const basePalette = (colors && colors.length > 0 ? colors : [...DEFAULT_COLOR_PALETTE]).map(
    (entry) => entry.toLowerCase()
  );
  const hasValueInPalette = normalizedValue
    ? basePalette.includes(normalizedValue)
    : false;
  const palette = hasValueInPalette
    ? [...basePalette]
    : normalizedValue
      ? [...basePalette, normalizedValue]
      : [...basePalette];

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current) {
        return;
      }
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const triggerIsTransparent = value === "transparent";
  const triggerColor =
    normalizedValue ?? DEFAULT_COLOR_PALETTE[0];

  return (
    <div
      ref={rootRef}
      className={`relative inline-flex ${className ?? ""}`.trim()}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`relative h-8 w-10 overflow-hidden rounded-lg border transition ${
          open ? "border-[var(--accent-0)] ring-1 ring-[var(--accent-0)]" : "border-[var(--line)]"
        } ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-[var(--accent-2)]"}`}
        aria-label={title ?? "Choose color"}
        title={title ?? "Choose color"}
      >
        {triggerIsTransparent ? (
          <span
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(45deg, rgba(255,255,255,0.3) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.3) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.3) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.3) 75%)",
              backgroundSize: "8px 8px",
              backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
              backgroundColor: "rgba(15,27,26,0.7)",
            }}
          />
        ) : (
          <span
            className="absolute inset-0"
            style={{ backgroundColor: triggerColor }}
          />
        )}
        <span className="absolute inset-y-0 right-1 flex items-center text-[10px] text-[var(--ink-0)]">
          v
        </span>
      </button>

      {open ? (
        <div
          className="absolute left-0 top-10 z-40 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2 shadow-xl shadow-black/40"
          role="radiogroup"
          aria-label={title ?? "Color palette"}
        >
          <div
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: "repeat(5, 24px)",
              gridAutoRows: "24px",
            }}
          >
            {allowTransparent ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange("transparent");
                  setOpen(false);
                }}
                className={`relative overflow-hidden rounded-md border p-0 m-0 leading-none transition ${
                  value === "transparent"
                    ? "border-[var(--accent-0)] ring-1 ring-[var(--accent-0)]"
                    : "border-[var(--line)]"
                } ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-[var(--accent-2)]"}`}
                style={{ width: 24, height: 24 }}
                aria-label="Transparent"
                title="Transparent"
              >
                <span
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg, rgba(255,255,255,0.3) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.3) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.3) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.3) 75%)",
                    backgroundSize: "8px 8px",
                    backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
                    backgroundColor: "rgba(15,27,26,0.7)",
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white">
                  /
                </span>
              </button>
            ) : null}
            {palette.map((color) => {
              const isSelected = normalizedValue === normalizeHexColor(color);
              return (
                <button
                  key={color}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(color);
                    setOpen(false);
                  }}
                  className={`rounded-md border p-0 m-0 leading-none transition ${
                    isSelected
                      ? "border-[var(--accent-0)] ring-1 ring-[var(--accent-0)]"
                      : "border-[var(--line)]"
                  } ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-[var(--accent-2)]"}`}
                  style={{ backgroundColor: color, width: 24, height: 24 }}
                  aria-label={color}
                  title={color}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
