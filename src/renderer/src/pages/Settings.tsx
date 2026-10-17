import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Database,
  Monitor,
  Search,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import {
  Link,
  Navigate,
  useLocation,
  useParams,
  type Location,
} from "react-router";
import { AppearanceSelector } from "../components/AppearanceSelector";
import { TitleBar } from "../components/TitleBar";
import { WorkflowSidebar } from "../components/WorkflowSidebar";
import { WorkspaceFrame } from "../components/WorkspaceFrame";
import { setSidebarCollapsed, useSidebarCollapsed } from "../theme/sidebar";

const sections = [
  {
    id: "general",
    title: "General",
    description: "App information and navigation.",
    icon: SettingsIcon,
  },
  {
    id: "appearance",
    title: "Appearance",
    description: "Theme and window appearance.",
    icon: Monitor,
  },
  {
    id: "workspace",
    title: "Workspace info",
    description: "Where your workflows and activity come from.",
    icon: Database,
  },
] as const;

type SectionId = (typeof sections)[number]["id"];
const settingRows: {
  id: string;
  section: SectionId;
  title: string;
  description: string;
  value?: string;
  keywords?: string;
}[] = [
  {
    id: "version",
    section: "general",
    title: "Version",
    description: "Ghost desktop.",
    value: "0.1.0",
  },
  {
    id: "welcome",
    section: "general",
    title: "Welcome",
    description: "Return to the introduction.",
    keywords: "back welcome introduction home",
  },
  {
    id: "theme",
    section: "appearance",
    title: "Theme",
    description:
      "System follows your device’s appearance. Your choice is saved on this device.",
    keywords: "light dark system color colour appearance",
  },
  {
    id: "source",
    section: "workspace",
    title: "Data source",
    description: "Discovery searches your configured local Screenpipe history.",
    value: "Screenpipe",
  },
  {
    id: "saved",
    section: "workspace",
    title: "Saved workflows",
    description: "Saved workflows use your configured backend.",
    value: "Configured backend",
  },
  {
    id: "templates",
    section: "workspace",
    title: "Template drafts",
    description:
      "Independent copies saved automatically to your configured backend.",
    value: "Saved drafts",
  },
  {
    id: "drafts",
    section: "workspace",
    title: "Imported drafts",
    description:
      "Imported drafts remain available across pages until you reload the app.",
    value: "Session only",
  },
];

function returnPath(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return "/dashboard";
  try {
    const target = new URL(value, "https://ghost.local");
    if (
      target.origin !== "https://ghost.local" ||
      !/^\/(?:dashboard|workflows(?:\/[^/?#]+(?:\/record\/[^/?#]+)?)?)?\/?$/.test(
        target.pathname,
      )
    )
      return "/dashboard";
    return target.pathname + target.search + target.hash;
  } catch {
    return "/dashboard";
  }
}

export function getSettingsBackground(value: unknown): Location | undefined {
  if (!value || typeof value !== "object") return;
  const candidate = value as Partial<Location>;
  if (typeof candidate.pathname !== "string") return;
  const search = typeof candidate.search === "string" ? candidate.search : "";
  const hash = typeof candidate.hash === "string" ? candidate.hash : "";
  const path = candidate.pathname + search + hash;
  if (returnPath(path) !== path) return;
  return {
    pathname: candidate.pathname,
    search,
    hash,
    state: candidate.state ?? null,
    key:
      typeof candidate.key === "string" ? candidate.key : "settings-background",
  };
}

export function Settings() {
  const { section: sectionParam } = useParams();
  const collapsed = useSidebarCollapsed();
  const location = useLocation();
  const state = location.state as {
    returnTo?: unknown;
    backgroundLocation?: unknown;
  } | null;
  const backgroundLocation = getSettingsBackground(state?.backgroundLocation);
  const returnTo = returnPath(
    state?.returnTo ??
      (backgroundLocation
        ? backgroundLocation.pathname +
          backgroundLocation.search +
          backgroundLocation.hash
        : undefined),
  );
  const navigationState = {
    returnTo,
    ...(backgroundLocation ? { backgroundLocation } : {}),
  };
  const section = sections.find(
    (item) => item.id === (sectionParam ?? "general"),
  );
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(!window.ghost?.browser);
  const heading = useRef<HTMLHeadingElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const normalized = query.trim().toLocaleLowerCase();
  const matches = settingRows.filter((row) => {
    if (!normalized) return row.section === section?.id;
    return [
      row.title,
      row.description,
      row.value,
      row.keywords,
      sections.find((item) => item.id === row.section)?.title,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalized);
  });

  useLayoutEffect(() => {
    const browser = window.ghost?.browser;
    const modalId = crypto.randomUUID();
    let disposed = false;
    if (browser)
      void browser
        .modal(modalId, true)
        .then(() => {
          if (!disposed) setVisible(true);
        })
        .catch(() => {
          /* Keep the page hidden if the native view cannot be occluded. */
        });
    else setVisible(true);
    return () => {
      disposed = true;
      if (browser) void browser.modal(modalId, false).catch(() => {});
    };
  }, []);
  useLayoutEffect(() => {
    if (visible) heading.current?.focus({ preventScroll: true });
  }, [visible, sectionParam]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => {
    scroll.current?.scrollTo({ top: 0 });
  }, [sectionParam, normalized]);

  if (!section)
    return <Navigate replace to="/settings" state={navigationState} />;
  const groups = normalized
    ? sections.filter((item) => matches.some((row) => row.section === item.id))
    : [section];
  return (
    <div
      className={`settings-shell fixed inset-0 z-40 overflow-hidden bg-canvas font-sans text-ink ${visible ? "" : "invisible pointer-events-none"}`}
    >
      <WorkspaceFrame nativeChrome={window.ghost?.platform === "darwin"}>
        <div className="flex h-full min-h-0">
          <WorkflowSidebar active="settings" />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            {window.ghost?.platform !== "darwin" && (
              <div className="settings-windowbar h-12 shrink-0">
                <TitleBar />
              </div>
            )}
            <div
              ref={scroll}
              className="settings-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
            >
              <div className="settings-content mx-auto w-full max-w-[920px] px-12 py-12 max-[1200px]:px-8 max-[760px]:px-6 max-[760px]:py-8">
                <header className="settings-header">
                  <div className="flex items-center justify-between gap-5">
                    <h1
                      ref={heading}
                      tabIndex={-1}
                      className="text-[32px] font-medium leading-tight tracking-tight outline-none"
                    >
                      Settings
                    </h1>
                    <Link
                      to={returnTo}
                      aria-label="Back to app"
                      className="text-button"
                    >
                      <ArrowLeft size={15} />
                      Back to app
                    </Link>
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    A workspace that feels right for you.
                  </p>
                </header>
                <nav
                  aria-label="Settings sections"
                  className="mt-8 flex gap-1 border-b border-line pb-3"
                >
                  {sections.map(({ id, title }) => (
                    <Link
                      key={id}
                      to={`/settings/${id}`}
                      state={navigationState}
                      onClick={() => setQuery("")}
                      aria-current={
                        !normalized && section.id === id ? "page" : undefined
                      }
                      className="settings-section-link rounded-control px-3 py-1.5 text-sm text-muted hover:bg-sunken aria-[current=page]:bg-action-soft aria-[current=page]:text-action"
                    >
                      {title === "Workspace info" ? "Workspace" : title}
                    </Link>
                  ))}
                </nav>
                <label className="mt-6 flex max-w-80 items-center gap-2 rounded-control border border-strong px-3 py-2.5 text-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-action">
                  <Search size={16} />
                  <input
                    ref={search}
                    type="search"
                    aria-label="Search settings"
                    placeholder="Search settings"
                    maxLength={200}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setQuery("");
                    }}
                    className="w-full min-w-0 border-0 bg-transparent text-sm text-ink outline-none focus-visible:outline-none"
                  />
                  {query && (
                    <button
                      aria-label="Clear settings search"
                      onClick={() => {
                        setQuery("");
                        search.current?.focus();
                      }}
                    >
                      <X size={15} />
                    </button>
                  )}
                </label>
                {normalized && (
                  <p className="mt-6 text-sm text-muted">
                    Settings matching “{query.trim()}”.
                  </p>
                )}
                {matches.length ? (
                  groups.map((group) => (
                    <section
                      key={group.id}
                      aria-label={group.title}
                      className="mt-10"
                    >
                      <h2 className="text-base font-medium">
                        {group.title === "Workspace info"
                          ? "Workspace data"
                          : group.title}
                      </h2>
                      <p className="mt-2 text-sm text-muted">
                        {group.description}
                      </p>
                      <div className="mt-6">
                        {matches
                          .filter((row) => row.section === group.id)
                          .map((row) => (
                            <article
                              key={row.id}
                              data-setting={row.id}
                              className={
                                row.id === "theme"
                                  ? "setting-card"
                                  : "setting-card flex flex-wrap items-center justify-between gap-5 border-b border-line py-6"
                              }
                            >
                              {row.id === "theme" ? (
                                <>
                                  <AppearanceSelector cards />
                                  <p className="mt-5 text-xs leading-relaxed text-muted">
                                    {row.description}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <div className="min-w-0">
                                    <h3 className="text-sm font-medium">
                                      {row.title}
                                    </h3>
                                    <p className="mt-1 text-xs leading-relaxed text-muted">
                                      {row.description}
                                    </p>
                                  </div>
                                  {row.value && (
                                    <span className="text-xs text-muted">
                                      {row.value}
                                    </span>
                                  )}
                                  {row.id === "welcome" && (
                                    <Link
                                      to="/"
                                      className="dash-button text-xs"
                                    >
                                      View introduction{" "}
                                      <ArrowUpRight size={14} />
                                    </Link>
                                  )}
                                </>
                              )}
                            </article>
                          ))}
                      </div>
                    </section>
                  ))
                ) : (
                  <div className="empty-state mt-8" role="status">
                    <Search size={24} />
                    <h2 className="text-base font-medium text-ink">
                      No settings found
                    </h2>
                    <p>Try searching for theme, version, or data.</p>
                    <button
                      className="dash-button mt-2"
                      onClick={() => {
                        setQuery("");
                        search.current?.focus();
                      }}
                    >
                      Clear search
                    </button>
                  </div>
                )}
                {!normalized && section.id === "appearance" && (
                  <section className="mt-10">
                    <h2 className="text-base font-medium">Navigation</h2>
                    <div className="mt-2 flex items-center justify-between gap-6 border-b border-line py-6">
                      <div>
                        <h3 className="text-sm font-medium">Compact sidebar</h3>
                        <p className="mt-1 text-xs text-muted">
                          Keep navigation available as an icon rail.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-label="Compact sidebar"
                        aria-checked={collapsed}
                        onClick={() => setSidebarCollapsed(!collapsed)}
                        className={`relative h-5.5 w-9 shrink-0 rounded-full p-0.75 transition-colors ${collapsed ? "bg-action-fill" : "bg-strong"}`}
                      >
                        <span
                          className={`block size-4 rounded-full bg-white transition-transform motion-reduce:transition-none ${collapsed ? "translate-x-3.5" : ""}`}
                        />
                      </button>
                    </div>
                  </section>
                )}
                <p className="mt-12 text-xs text-muted">
                  Ghost · 0.1.0 · Made for the work that matters.
                </p>
              </div>
            </div>
          </main>
        </div>
      </WorkspaceFrame>
    </div>
  );
}
