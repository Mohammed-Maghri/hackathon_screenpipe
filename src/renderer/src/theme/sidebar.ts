import { useSyncExternalStore } from "react";
const key = "ghost.sidebar.collapsed";
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
};
let collapsed = read();
window.addEventListener("storage", (event) => {
  if (event.key === key || event.key === null) {
    collapsed = read();
    listeners.forEach((listener) => listener());
  }
});
export function setSidebarCollapsed(value: boolean) {
  collapsed = value;
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* Preserve the in-memory preference. */
  }
  listeners.forEach((listener) => listener());
}
export function useSidebarCollapsed() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => collapsed,
  );
}
