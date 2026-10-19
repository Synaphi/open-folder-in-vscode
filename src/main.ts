import { Menu, Notice, Platform, Plugin, PluginSettingTab, Setting, TFolder, getLanguage } from "obsidian";
import type { ExecFileSyncOptions } from "child_process";
import type { DesktopIo } from "./locate";
import { launchSpec, resolveConfigured, resolveFolder, uniqueFolderPaths } from "./locate";
import { translate } from "./i18n";

// File explorer selection has no public API. Check these optional members
// before handling a click, so incompatible versions keep their native behavior.
interface SelectableExplorer {
  containerEl: HTMLElement;
  fileBeingRenamed?: unknown;
  fileItems?: Record<string, { file: unknown; selfEl: HTMLElement }>;
  tree?: { handleItemSelection?: (event: MouseEvent, item: unknown) => boolean };
}

interface Settings {
  executable: string;
  ctrlClickSelection: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  executable: "",
  ctrlClickSelection: false,
};

function text(key: Parameters<typeof translate>[1]): string {
  return translate(getLanguage(), key);
}

function desktopIo(): DesktopIo | null {
  if (!Platform.isDesktop) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Obsidian's CommonJS loader resolves Node builtins only through require().
  const fs = require("fs") as typeof import("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Obsidian's CommonJS loader resolves Node builtins only through require().
  const path = require("path") as typeof import("path");
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Obsidian's CommonJS loader resolves Node builtins only through require().
  const childProcess = require("child_process") as typeof import("child_process");
  return {
    platform: process.platform,
    env: process.env,
    exists: (filePath) => {
      try {
        return fs.existsSync(filePath);
      } catch {
        return false;
      }
    },
    isDirectory: (filePath) => {
      try {
        return fs.statSync(filePath).isDirectory();
      } catch {
        return false;
      }
    },
    which: (command) => {
      const locator = process.platform === "win32" ? "where.exe" : "which";
      try {
        const options: ExecFileSyncOptions = {
          encoding: "utf8",
          timeout: 4000,
          windowsHide: true,
        };
        const output = childProcess.execFileSync(locator, [command], options);
        const textOutput = typeof output === "string" ? output : output.toString("utf8");
        const line = textOutput
          .split(/\r?\n/)
          .map((entry) => entry.trim())
          .find(Boolean);
        return line ?? null;
      } catch {
        return null;
      }
    },
    join: (...parts) => path.join(...parts),
    dirname: (filePath) => path.dirname(filePath),
    resolve: (...parts) => path.resolve(...parts),
    spawn: (command, args, options) => childProcess.spawn(command, args, options),
  };
}

export default class OpenInVsCodePlugin extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };
  private selectionContainers = new WeakSet<HTMLElement>();

  async onload(): Promise<void> {
    const saved = (await this.loadData()) as Partial<Settings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
    this.addSettingTab(new OpenInVsCodeSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => this.registerFolderSelection());
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.registerFolderSelection()),
    );
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFolder)) return;
        this.addOpenItem(menu, [file]);
      }),
    );
    this.registerEvent(
      this.app.workspace.on("files-menu", (menu, files) => {
        const folders = files.filter((file): file is TFolder => file instanceof TFolder);
        if (folders.length === 0) return;
        this.addOpenItem(menu, folders);
      }),
    );
  }

  private registerFolderSelection(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("file-explorer")) {
      const view = leaf.view as unknown as SelectableExplorer;
      const container = view.containerEl;
      if (this.selectionContainers.has(container)) continue;
      this.selectionContainers.add(container);
      this.registerDomEvent(container, "click", (event) => {
        if (!this.settings.ctrlClickSelection || event.defaultPrevented
          || event.button !== 0 || !event.ctrlKey || event.altKey) return;
        const win = container.ownerDocument.defaultView;
        if (!win || !(event.target instanceof win.Element)) return;
        if (event.target.closest("input, textarea, [contenteditable='true']")) return;
        const row = event.target.closest<HTMLElement>(".nav-folder-title");
        if (!row || !container.contains(row)) return;
        const path = row.getAttribute("data-path");
        const item = path === null ? undefined : view.fileItems?.[path];
        const tree = view.tree;
        if (!item || item.selfEl !== row || !(item.file instanceof TFolder)
          || view.fileBeingRenamed === item.file || typeof tree?.handleItemSelection !== "function") return;

        // Reuse Obsidian's Alt-click selection (or Shift-click range selection)
        // without dispatching a second DOM event. Consume the original click
        // before either the folder title or disclosure arrow can toggle.
        const selectionEvent = new win.MouseEvent("click", {
          button: 0,
          altKey: !event.shiftKey,
          shiftKey: event.shiftKey,
        });
        if (!tree.handleItemSelection(selectionEvent, item)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, { capture: true });
    }
  }

  private addOpenItem(menu: Menu, folders: TFolder[]): void {
    menu.addItem((item) => {
      item
        .setTitle(text("menu"))
        .setIcon("code")
        .onClick(() => {
          this.openFolders(folders);
        });
    });
  }

  openFolders(folders: TFolder[]): void {
    const io = desktopIo();
    if (!io) {
      new Notice(text("launchFailed"));
      return;
    }
    const resolved: string[] = [];
    for (const folder of folders) {
      const full = resolveFolder(this.app.vault.adapter, folder.path, io);
      if (!full || !io.exists(full) || !io.isDirectory(full)) {
        new Notice(text("noPath"));
        return;
      }
      resolved.push(full);
    }
    const paths = uniqueFolderPaths(resolved, io.platform);
    if (paths.length === 0) {
      new Notice(text("noPath"));
      return;
    }
    const configured = this.settings.executable.trim();
    if (configured && !io.exists(configured)) {
      new Notice(text("pathMissing"));
      return;
    }
    const exe = resolveConfigured(io, configured);
    if (!exe) {
      new Notice(configured ? text("pathMissing") : text("notFound"));
      return;
    }
    const spec = launchSpec(exe, paths);
    try {
      const child = io.spawn(spec.command, spec.args, spec.options);
      child.on("error", () => {
        new Notice(text("launchFailed"));
      });
      child.unref();
    } catch {
      new Notice(text("launchFailed"));
    }
  }
}

class OpenInVsCodeSettingTab extends PluginSettingTab {
  plugin: OpenInVsCodePlugin;

  constructor(app: OpenInVsCodePlugin["app"], plugin: OpenInVsCodePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName(text("settingName"))
      .setDesc(text("settingDesc"))
      .addText((field) => {
        field
          .setPlaceholder(text("settingName"))
          .setValue(this.plugin.settings.executable)
          .onChange(async (value) => {
            this.plugin.settings.executable = value.trim();
            await this.plugin.saveData(this.plugin.settings);
          });
      });
    new Setting(containerEl)
      .setName(text("ctrlClickName"))
      .setDesc(text("ctrlClickDesc"))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.ctrlClickSelection).onChange(async (value) => {
          this.plugin.settings.ctrlClickSelection = value;
          await this.plugin.saveData(this.plugin.settings);
        });
      });
  }

  getSettingDefinitions() {
    return [
      {
        name: text("settingName"),
        desc: text("settingDesc"),
        control: {
          type: "text" as const,
          key: "executable",
          placeholder: text("settingName"),
        },
      },
      {
        name: text("ctrlClickName"),
        desc: text("ctrlClickDesc"),
        control: {
          type: "toggle" as const,
          key: "ctrlClickSelection",
        },
      },
    ];
  }

  getControlValue(key: string): unknown {
    if (key === "executable") return this.plugin.settings.executable;
    if (key === "ctrlClickSelection") return this.plugin.settings.ctrlClickSelection;
    return "";
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === "ctrlClickSelection" && typeof value === "boolean") {
      this.plugin.settings.ctrlClickSelection = value;
      await this.plugin.saveData(this.plugin.settings);
      return;
    }
    if (key !== "executable" || typeof value !== "string") return;
    this.plugin.settings.executable = value.trim();
    await this.plugin.saveData(this.plugin.settings);
  }
}
