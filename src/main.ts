import { Notice, Platform, Plugin, PluginSettingTab, Setting, TFolder, getLanguage } from "obsidian";
import type { ExecFileSyncOptions } from "child_process";
import type { DesktopIo } from "./locate";
import { launchSpec, resolveConfigured, resolveFolder } from "./locate";
import { translate } from "./i18n";

interface Settings {
  executable: string;
}

const DEFAULT_SETTINGS: Settings = {
  executable: "",
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

  async onload(): Promise<void> {
    const saved = (await this.loadData()) as Partial<Settings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
    this.addSettingTab(new OpenInVsCodeSettingTab(this.app, this));
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFolder)) return;
        menu.addItem((item) => {
          item
            .setTitle(text("menu"))
            .setIcon("code")
            .onClick(() => {
              this.openFolder(file);
            });
        });
      }),
    );
  }

  openFolder(folder: TFolder): void {
    const io = desktopIo();
    if (!io) {
      new Notice(text("launchFailed"));
      return;
    }
    const full = resolveFolder(this.app.vault.adapter, folder.path, io);
    if (!full || !io.exists(full) || !io.isDirectory(full)) {
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
    const spec = launchSpec(exe, full);
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
    ];
  }

  getControlValue(key: string): unknown {
    if (key === "executable") return this.plugin.settings.executable;
    return "";
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (key !== "executable" || typeof value !== "string") return;
    this.plugin.settings.executable = value.trim();
    await this.plugin.saveData(this.plugin.settings);
  }
}
