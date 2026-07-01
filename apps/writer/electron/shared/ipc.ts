export const WRITER_COMMAND_EVENT = "writer-command";
export const FILE_TREE_CHANGED_EVENT = "file-tree-changed";

export const IPC = {
  documents: {
    list: "madinah:documents:list",
    get: "madinah:documents:get",
    save: "madinah:documents:save",
    delete: "madinah:documents:delete",
  },
  files: {
    readMarkdown: "madinah:files:read-markdown",
    writeMarkdown: "madinah:files:write-markdown",
  },
  fileTree: {
    list: "madinah:file-tree:list",
    createFile: "madinah:file-tree:create-file",
    createDirectory: "madinah:file-tree:create-directory",
    renamePath: "madinah:file-tree:rename-path",
    duplicateFile: "madinah:file-tree:duplicate-file",
    moveToTrash: "madinah:file-tree:move-to-trash",
    revealPath: "madinah:file-tree:reveal-path",
    watch: "madinah:file-tree:watch",
    unwatch: "madinah:file-tree:unwatch",
  },
  recent: {
    list: "madinah:recent:list",
    add: "madinah:recent:add",
  },
  blog: {
    importDirectory: "madinah:blog:import-directory",
    exportDocument: "madinah:blog:export-document",
  },
  plugins: {
    resolveWorkspace: "madinah:plugins:resolve-workspace",
    resolveWorkspacePlugins: "madinah:plugins:resolve-workspace-plugins",
    readTrustedPluginBundle: "madinah:plugins:read-trusted-bundle",
    setWorkspacePluginTrust: "madinah:plugins:set-workspace-trust",
  },
  dialog: {
    confirm: "madinah:dialog:confirm",
    openDirectory: "madinah:dialog:open-directory",
    openMarkdownFile: "madinah:dialog:open-markdown-file",
    saveMarkdownFile: "madinah:dialog:save-markdown-file",
    showContextMenu: "madinah:dialog:show-context-menu",
  },
  aiPolish: {
    polish: "madinah:ai-polish:polish",
    check: "madinah:ai-polish:check",
  },
  assetUpload: {
    loadSettings: "madinah:asset-upload:load-settings",
    saveSettings: "madinah:asset-upload:save-settings",
    checkSettings: "madinah:asset-upload:check-settings",
    uploadImage: "madinah:asset-upload:upload-image",
  },
} as const;
