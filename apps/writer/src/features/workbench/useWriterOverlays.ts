import { useCallback, useState } from "react";

interface UseWriterOverlaysOptions {
  restoreEditorFocus: () => void;
  clearDocumentSearchHighlight: () => void;
}

export function useWriterOverlays({
  restoreEditorFocus,
  clearDocumentSearchHighlight,
}: UseWriterOverlaysOptions) {
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState("");
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [isDocumentSearchOpen, setIsDocumentSearchOpen] = useState(false);
  const [documentSearchQuery, setDocumentSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [isReplaceVisible, setIsReplaceVisible] = useState(false);
  const [documentReplaceQuery, setDocumentReplaceQuery] = useState("");
  const [isSearchCaseSensitive, setIsSearchCaseSensitive] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const closeCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(false);
    setCommandPaletteQuery("");
    restoreEditorFocus();
  }, [restoreEditorFocus]);

  const closeDocumentSearch = useCallback(() => {
    setIsDocumentSearchOpen(false);
    setDocumentSearchQuery("");
    setActiveSearchIndex(-1);
    setIsReplaceVisible(false);
    setDocumentReplaceQuery("");
    clearDocumentSearchHighlight();
    restoreEditorFocus();
  }, [clearDocumentSearchHighlight, restoreEditorFocus]);

  const closeQuickOpen = useCallback(() => {
    setIsQuickOpenOpen(false);
    setQuickOpenQuery("");
    restoreEditorFocus();
  }, [restoreEditorFocus]);

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
    restoreEditorFocus();
  }, [restoreEditorFocus]);

  return {
    isQuickOpenOpen,
    setIsQuickOpenOpen,
    quickOpenQuery,
    setQuickOpenQuery,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    commandPaletteQuery,
    setCommandPaletteQuery,
    isDocumentSearchOpen,
    setIsDocumentSearchOpen,
    documentSearchQuery,
    setDocumentSearchQuery,
    activeSearchIndex,
    setActiveSearchIndex,
    isReplaceVisible,
    setIsReplaceVisible,
    documentReplaceQuery,
    setDocumentReplaceQuery,
    isSearchCaseSensitive,
    setIsSearchCaseSensitive,
    isSettingsOpen,
    setIsSettingsOpen,
    closeCommandPalette,
    closeDocumentSearch,
    closeQuickOpen,
    closeSettings,
  };
}
