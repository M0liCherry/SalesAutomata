import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

function currentRoute(): string {
  if (window.location.hash.startsWith("#/")) {
    const hashRoute = window.location.hash.replace(/^#/, "");
    window.history.replaceState({}, "", hashRoute);
    return hashRoute;
  }
  return window.location.pathname || "/";
}

export function useRoute(): string {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onChange = () => setRoute(window.location.pathname || "/");
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);

  return route;
}

export function navigate(path: string): void {
  if (`${window.location.pathname}${window.location.search}` === path) {
    return;
  }
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "instant" });
}

export function Link({
  to,
  children,
  className,
  ariaLabel,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} className={className} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </a>
  );
}
