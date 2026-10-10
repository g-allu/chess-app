import { useEffect, useRef, useState } from "react";

type Theme = "light" | "dark";
const THEME_KEY = "tempo:theme";

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function useTheme() {
  const explicit = useRef(savedTheme() !== null);
  const [theme, setTheme] = useState<Theme>(() => {
    const initial = document.documentElement.dataset.theme;
    return initial === "light" || initial === "dark"
      ? initial
      : (savedTheme() ??
          (window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"));
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#151d19" : "#f7f8f4");
  }, [theme]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = (event: MediaQueryListEvent) => {
      if (!explicit.current) setTheme(event.matches ? "dark" : "light");
    };
    preference.addEventListener("change", followSystem);
    return () => preference.removeEventListener("change", followSystem);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    explicit.current = true;
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // The toggle still works for this session when preferences cannot be saved.
    }
  }

  return { theme, toggleTheme };
}
