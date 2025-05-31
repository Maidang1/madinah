import { atom, useAtom } from "jotai";
import { useFetcher } from "@remix-run/react";
import { type Theme } from "~/utils/theme-sync";

import { useEffect } from "react";
export const themeAtom = atom<Theme>("light")

export const useTheme = () => {
  const [theme, setTheme] = useAtom(themeAtom);
  const fetcher = useFetcher();

  const syncThemeToServer = (theme: Theme) => {
    fetcher.submit(
      { theme },
      { method: "post", action: "/" }
    );
  };

  useEffect(() => {
    syncThemeToServer(theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };


  return {
    theme,
    setTheme,
    toggleTheme,
    isSubmitting: fetcher.state !== "idle",
  };
}