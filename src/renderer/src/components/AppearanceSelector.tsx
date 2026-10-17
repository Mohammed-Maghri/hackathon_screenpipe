import { Monitor, Moon, Sun } from "lucide-react";
import { setThemePreference, useAppearance } from "../theme/appearance";
const choices = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;
export function AppearanceSelector({
  compact = false,
  cards = false,
}: {
  compact?: boolean;
  cards?: boolean;
}) {
  const { preference } = useAppearance();
  return (
    <fieldset
      className={`appearance-selector min-w-0 border-0 p-0 ${compact || cards ? "" : "my-5"}`}
    >
      <legend
        className={
          compact || cards ? "sr-only" : "mb-3 text-sm font-medium text-ink"
        }
      >
        Appearance
      </legend>
      <div
        className={
          cards
            ? "grid grid-cols-3 gap-4 max-[600px]:gap-3"
            : "inline-flex max-w-full flex-wrap gap-1 rounded-control border border-line bg-canvas p-1"
        }
      >
        {choices.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            value={value}
            aria-pressed={preference === value}
            onClick={() => setThemePreference(value)}
            className={
              cards
                ? "theme-option min-w-0 rounded-card text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action"
                : `inline-flex min-h-9 items-center justify-center gap-2 rounded-control border px-3 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-action ${preference === value ? "border-line bg-panel font-medium text-action shadow-soft" : "border-transparent text-muted hover:bg-sunken hover:text-ink"}`
            }
          >
            {cards && (
              <span
                className={`theme-thumbnail flex h-32 overflow-hidden rounded-card border max-[600px]:h-24 ${preference === value ? "border-action ring-3 ring-action-soft" : "border-strong"} ${value === "dark" ? "bg-[var(--gray-950)]" : "bg-white"}`}
              >
                <span
                  className={`flex w-[30%] flex-col gap-2 border-r p-3 max-[600px]:p-2 ${value === "dark" ? "border-[var(--gray-800)] bg-[var(--gray-900)]" : "border-[var(--gray-200)] bg-[var(--gray-50)]"}`}
                >
                  <i className="mb-1 block h-1 w-full rounded-sm bg-brand" />
                  <i className="block h-1 w-full rounded-sm bg-[var(--gray-400)]" />
                  <i className="block h-1 w-full rounded-sm bg-[var(--gray-400)]" />
                </span>
                <span
                  className={`flex w-[70%] flex-col gap-2 px-3 py-7 max-[600px]:px-2 ${value === "system" ? "border-r-[64px] border-[var(--gray-950)] max-[600px]:border-r-[32px]" : ""}`}
                >
                  <i className="mb-1 block h-2 w-3/5 rounded-sm bg-[var(--gray-400)]" />
                  <i className="block h-1 w-full rounded-sm bg-[var(--gray-300)]" />
                  <i className="block h-1 w-4/5 rounded-sm bg-[var(--gray-300)]" />
                  <i className="mt-2 block h-5 w-full rounded-sm border border-[var(--gray-400)]" />
                </span>
              </span>
            )}
            <span
              className={
                cards
                  ? "mt-3 flex items-center gap-2 text-sm max-[600px]:gap-1 max-[600px]:text-xs"
                  : "contents"
              }
            >
              <Icon size={15} aria-hidden="true" />
              <span>{label}</span>
              {cards && (
                <span
                  className={`ml-auto size-4 rounded-full border ${preference === value ? "border-5 border-action" : "border-strong"}`}
                />
              )}
            </span>
          </button>
        ))}
      </div>
      {!compact && !cards && (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          System follows your device’s appearance. Your choice is saved on this
          device.
        </p>
      )}
    </fieldset>
  );
}
