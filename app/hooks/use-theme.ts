import { atom, useAtom } from "jotai";
import { useFetcher } from "@remix-run/react";
import { useHydrateAtoms } from "jotai/utils";

import { useEffect } from "react";
import { Theme } from "~/types";
export const themeAtom = atom<Theme>("light")

export const useTheme = (initTheme: Theme) => {
  useHydrateAtoms([[themeAtom, initTheme]]);
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