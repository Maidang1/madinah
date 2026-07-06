import { AppLayout } from "./components/app-layout";
import { CommandPalette } from "./components/command-palette";
import { WelcomeScreen } from "./components/welcome";
import { WindowTitle } from "./components/window-title";
import { useWorkspace, useIsStartupResolved } from "./hooks/use-workspace";
import { useFileWatcher } from "./hooks/use-file-watcher";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { useMenuEvents } from "./hooks/use-menu-events";
import { useOpenDrop } from "./hooks/use-open-drop";
import "./lib/global-recents";
import "./lib/standalone-watch";
import "./App.css";

function App() {
  const { root, chromeMode } = useWorkspace();
  const isStartupResolved = useIsStartupResolved();

  useFileWatcher();
  useKeyboardShortcuts();
  useMenuEvents();
  useOpenDrop();

  if (!isStartupResolved) {
    return null;
  }

  // Standalone compact windows render the compact layout with no root.
  if (!root && chromeMode !== "compact-file") {
    return (
      <>
        <WindowTitle />
        <WelcomeScreen />
        <CommandPalette />
      </>
    );
  }

  return (
    <>
      <WindowTitle />
      <AppLayout />
      <CommandPalette />
    </>
  );
}

export default App;
