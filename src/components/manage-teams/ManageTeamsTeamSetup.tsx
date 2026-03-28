"use client";

import type { RefObject, ReactNode } from "react";
import ColorPalettePicker from "@/components/ColorPalettePicker";
import type { JerseyType, SquadPreset } from "@/models";

type ShirtTypeOption = {
  id: JerseyType;
  label: string;
};

type ManageTeamsTeamSetupProps = {
  editableSquad: SquadPreset["squad"] | null;
  jerseyType: JerseyType;
  shirtTypes: ShirtTypeOption[];
  manageLogoRef: RefObject<HTMLInputElement | null>;
  updateEditableSquad: (payload: Partial<SquadPreset["squad"]>) => void;
  onJerseyTypeChange: (type: JerseyType) => void;
  renderShirtIcon: (
    type: JerseyType,
    primary: string,
    secondary: string,
    className: string
  ) => ReactNode;
};

export default function ManageTeamsTeamSetup({
  editableSquad,
  jerseyType,
  shirtTypes,
  manageLogoRef,
  updateEditableSquad,
  onJerseyTypeChange,
  renderShirtIcon,
}: ManageTeamsTeamSetupProps) {
  return (
    <div className="space-y-3 rounded-3xl border border-[var(--line)] bg-[var(--panel-2)]/25 p-4">
      <p className="text-[11px] uppercase tracking-widest text-[var(--ink-1)]">
        Appearance
      </p>
      <div className="grid gap-4 lg:grid-cols-[140px_minmax(0,1fr)] xl:grid-cols-[140px_minmax(0,1fr)_160px]">
        <button
          className="flex h-32 w-full items-center justify-center overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/55 text-[11px] text-[var(--ink-1)] lg:h-full"
          onClick={() => manageLogoRef.current?.click()}
          title="Change club logo"
        >
          {editableSquad?.clubLogo ? (
            <img
              src={editableSquad.clubLogo}
              alt="Club logo"
              className="h-full w-full object-contain p-2"
            />
          ) : (
            <span>Club Logo</span>
          )}
        </button>
        <div className="flex min-h-[180px] flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/35 p-4">
          <span className="text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
            Squad name
          </span>
          <input
            className="h-9 w-full rounded-full border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--ink-0)]"
            value={editableSquad?.name ?? ""}
            onChange={(event) => {
              updateEditableSquad({ name: event.target.value });
            }}
            placeholder="Team name"
          />
          {editableSquad ? (
            <>
              <span className="text-[10px] uppercase tracking-wide text-[var(--ink-1)]">
                Team colors
              </span>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[10px] text-[var(--ink-1)]">Shirt Base</span>
                  <ColorPalettePicker
                    value={editableSquad.kit.shirt}
                    onChange={(value) =>
                      updateEditableSquad({
                        kit: { ...editableSquad.kit, shirt: value },
                      })
                    }
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] text-[var(--ink-1)]">Shirt Secondary</span>
                  <ColorPalettePicker
                    value={editableSquad.kit.shirtSecondary ?? editableSquad.kit.shirt}
                    onChange={(value) =>
                      updateEditableSquad({
                        kit: {
                          ...editableSquad.kit,
                          shirtSecondary: value,
                        },
                      })
                    }
                  />
                </label>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-[10px] text-[var(--ink-1)]">Shorts</span>
                  <ColorPalettePicker
                    value={editableSquad.kit.shorts}
                    onChange={(value) =>
                      updateEditableSquad({
                        kit: { ...editableSquad.kit, shorts: value },
                      })
                    }
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] text-[var(--ink-1)]">Socks</span>
                  <ColorPalettePicker
                    value={editableSquad.kit.socks}
                    onChange={(value) =>
                      updateEditableSquad({
                        kit: { ...editableSquad.kit, socks: value },
                      })
                    }
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-[var(--ink-1)]">Type of jersey</span>
                {shirtTypes.map((item) => (
                  <button
                    key={item.id}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
                      (editableSquad.kit.jerseyType ?? jerseyType) === item.id
                        ? "border-[var(--accent-0)]"
                        : "border-[var(--line)]"
                    }`}
                    onClick={() => {
                      onJerseyTypeChange(item.id);
                      updateEditableSquad({
                        kit: { ...editableSquad.kit, jerseyType: item.id },
                      });
                    }}
                    title={item.label}
                    aria-label={item.label}
                  >
                    {renderShirtIcon(
                      item.id,
                      editableSquad.kit.shirt,
                      editableSquad.kit.shirtSecondary ?? editableSquad.kit.shirt,
                      "h-5 w-5"
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
        <div className="hidden min-h-[180px] flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--panel-2)]/35 p-4 xl:flex">
          {editableSquad ? (
            <div className="flex flex-col items-center gap-1">
              {renderShirtIcon(
                editableSquad.kit.jerseyType ?? jerseyType,
                editableSquad.kit.shirt,
                editableSquad.kit.shirtSecondary ?? editableSquad.kit.shirt,
                "h-20 w-20"
              )}
              <svg viewBox="0 0 64 40" className="h-7 w-11" aria-hidden>
                <path
                  d="M6 6h52l-4 28H36V22H28v12H10z"
                  fill={editableSquad.kit.shorts}
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              <svg viewBox="0 0 64 40" className="h-7 w-11" aria-hidden>
                <path
                  d="M16 5h12v14l8 6v8H16z"
                  fill={editableSquad.kit.socks}
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M36 5h12v14l8 6v8H36z"
                  fill={editableSquad.kit.socks}
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          ) : null}
        </div>
      </div>
      <input
        ref={manageLogoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              updateEditableSquad({ clubLogo: reader.result });
            }
          };
          reader.readAsDataURL(file);
        }}
      />
    </div>
  );
}
