import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function NodeInspector({
  title,
  children,
  wide = false,
  onClose,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    return () => {
      requestAnimationFrame(() => {
        if (
          previous?.isConnected &&
          (!document.activeElement ||
            document.activeElement === document.body ||
            !document.activeElement.isConnected)
        )
          previous.focus({ preventScroll: true });
      });
    };
  }, []);
  return (
    <aside
      ref={panel}
      tabIndex={-1}
      aria-label="Node settings"
      className={`node-settings-panel relative z-10 flex min-h-0 shrink-0 flex-col border-l border-line bg-canvas outline-none max-[1200px]:absolute max-[1200px]:inset-y-0 max-[1200px]:right-0 max-[1200px]:shadow-float ${wide ? "w-[420px] max-[1440px]:w-[380px]" : "w-[340px]"} max-[760px]:w-[min(360px,calc(100%-32px))]`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-line px-5">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Node settings</p>
          <h2 className="mt-1 truncate text-sm font-medium" title={title}>
            {title}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close node settings"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </header>
      <div className="node-settings-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 [scrollbar-gutter:stable]">
        {children}
      </div>
    </aside>
  );
}
