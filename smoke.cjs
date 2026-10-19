const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const childProcess = require("child_process");

function fail(message) {
  console.error("FAIL", message);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function loadBundle(entry) {
  const result = esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    format: "cjs",
    platform: "node",
    write: false,
    logLevel: "silent",
  });
  const filename = path.join(__dirname, entry);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(__dirname);
  mod._compile(result.outputFiles[0].text, filename);
  return mod.exports;
}

const codeExe = path.join(
  process.env.LOCALAPPDATA || "",
  "Programs",
  "Microsoft VS Code",
  "Code.exe",
);
if (fs.existsSync(codeExe)) {
  const version = childProcess.execFileSync(codeExe, ["--version"], {
    encoding: "utf8",
    timeout: 20000,
    windowsHide: true,
  });
  const first = version.split(/\r?\n/).find(Boolean);
  assert(first && first.length > 0, "Code.exe --version was empty");
  console.log("Code.exe", first);
}

const i18n = loadBundle("src/i18n.ts");
const locate = loadBundle("src/locate.ts");

const codes = i18n.languageCodes();
console.log("languages", codes.length);
assert(codes.length >= 70, "expected every Obsidian app language, got " + codes.length);
for (const code of codes) {
  for (const key of i18n.KEYS) {
    const value = i18n.translate(code, key);
    assert(typeof value === "string" && value.trim().length > 0, code + " missing " + key);
  }
  if (code !== "en" && code !== "en-gb") {
    assert(i18n.translate(code, "menu") !== i18n.translate("en", "menu"), code + " menu is English");
  }
}

assert(i18n.translate("ko", "menu") === "VS Code로 열기", "Korean menu");
assert(i18n.translate("ja", "menu") === "VS Codeで開く", "Japanese menu");
assert(i18n.translate("es", "menu") === "Abrir en VS Code", "Spanish menu");
assert(i18n.translate("en", "menu") === "Open in VS Code", "English menu");
assert(i18n.translate("zh-TW", "menu") === "用 VS Code 開啟", "Traditional Chinese menu");
assert(i18n.translate("zh-CN", "menu") === "在 VS Code 中打开", "Simplified Chinese menu");
assert(i18n.canonicalLanguage("pt-BR") === "pt-br", "Brazilian Portuguese code");
assert(i18n.translate("pt-BR", "settingDesc").includes("detectar"), "Brazilian Portuguese detect");
assert(i18n.translate("pt-PT", "settingDesc").includes("detetar"), "European Portuguese detect");
assert(i18n.translate("en-US", "menu") === "Open in VS Code", "en-US falls back to English");
assert(i18n.translate("xx-unknown", "menu") === "Open in VS Code", "unknown language falls back");

const folder = "C:\\Obsidian\\25. DutyFlow_Growth";
const spec = locate.launchSpec(codeExe || "Code.exe", folder);
assert(spec.args.length === 1 && spec.args[0] === folder, "folder is one argument");
assert(spec.options.shell === false, "launch must not use a shell");
assert(spec.command === (codeExe || "Code.exe"), "launch command");

const many = locate.launchSpec("Code.exe", ["C:\\one", "C:\\two"]);
assert(many.args.length === 2 && many.args[0] === "C:\\one" && many.args[1] === "C:\\two", "multi-root args");
assert(!many.args.includes("--new-window"), "multi-root has no new-window flag");
assert(many.options.shell === false, "multi-root is not a shell");
const winUnique = locate.uniqueFolderPaths(["C:\\A", "c:\\a", "C:\\B"], "win32");
assert(winUnique.length === 2 && winUnique[0] === "C:\\A" && winUnique[1] === "C:\\B", "windows path dedupe");
const linuxUnique = locate.uniqueFolderPaths(["/A", "/a"], "linux");
assert(linuxUnique.length === 2 && linuxUnique[0] === "/A" && linuxUnique[1] === "/a", "linux paths stay distinct");

const winIo = {
  platform: "win32",
  env: {
    LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local",
    ProgramFiles: "C:\\Program Files",
    "ProgramFiles(x86)": "C:\\Program Files (x86)",
  },
  exists(filePath) {
    return filePath === "C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe";
  },
  which() {
    return null;
  },
  join: (...parts) => path.win32.join(...parts),
  dirname: (filePath) => path.win32.dirname(filePath),
  resolve: (...parts) => path.win32.resolve(...parts),
};
assert(
  locate.findExecutable(winIo) === "C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe",
  "Windows stable install",
);

const cmdIo = {
  ...winIo,
  exists(filePath) {
    return filePath === "C:\\Code.exe";
  },
  which() {
    return "C:\\bin\\code.cmd";
  },
};
assert(locate.findExecutable(cmdIo) === "C:\\Code.exe", "code.cmd resolves to Code.exe");
assert(
  locate.resolveFolder({ getFullPath: () => folder }, "25. DutyFlow_Growth", winIo) === folder,
  "adapter path",
);

const notices = [];
const launches = [];
const settingTabs = [];
const toggleControls = [];
let savedData = null;
let language = "ko";
const obsidian = {
  Platform: { isDesktop: true },
  getLanguage: () => language,
  TFolder: class TFolder {
    constructor(folderPath) {
      this.path = folderPath;
    }
  },
  TFile: class TFile {
    constructor(filePath) {
      this.path = filePath;
    }
  },
  Notice: class Notice {
    constructor(message) {
      notices.push(message);
    }
  },
  Plugin: class Plugin {
    constructor(app) {
      this.app = app;
    }
    async loadData() {
      return savedData;
    }
    async saveData(data) {
      savedData = { ...data };
    }
    addSettingTab(tab) { settingTabs.push(tab); }
    registerEvent() {}
    registerDomEvent() {}
  },
  PluginSettingTab: class PluginSettingTab {
    constructor(app, plugin) {
      this.app = app;
      this.plugin = plugin;
      this.containerEl = { empty() {} };
    }
  },
  Setting: class Setting {
    setName() {
      return this;
    }
    setDesc() {
      return this;
    }
    addText() {
      return this;
    }
    addToggle(callback) {
      const toggle = {
        setValue(value) { this.value = value; return this; },
        onChange(callback) { this.change = callback; return this; },
      };
      callback(toggle);
      toggleControls.push(toggle);
      return this;
    }
  },
};

const missingDirs = new Set();

function isVaultPath(filePath) {
  const normalized = String(filePath).replace(/\//g, "\\").toLowerCase();
  return normalized === "c:\\obsidian" || normalized.startsWith("c:\\obsidian\\");
}

const fsMock = {
  existsSync(filePath) {
    if (missingDirs.has(filePath)) return false;
    const normalized = String(filePath).replace(/\//g, "\\").toLowerCase();
    if (normalized.endsWith("\\microsoft vs code\\code.exe")) return true;
    return isVaultPath(filePath);
  },
  statSync(filePath) {
    if (missingDirs.has(filePath)) {
      const error = new Error("missing");
      error.code = "ENOENT";
      throw error;
    }
    if (isVaultPath(filePath)) return { isDirectory: () => true };
    const error = new Error("missing");
    error.code = "ENOENT";
    throw error;
  },
};

const cpMock = {
  execFileSync() {
    throw new Error("PATH lookup is unused when Code.exe exists");
  },
  spawn(command, args, options) {
    launches.push({ command, args, options });
    return { on() {}, unref() {} };
  },
};

const realRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === "obsidian") return obsidian;
  if (id === "fs") return fsMock;
  if (id === "child_process") return cpMock;
  return realRequire.apply(this, arguments);
};

const pluginModule = require("./main.js");
const PluginClass = pluginModule.default || pluginModule;
const menuHandlers = {};
const app = {
  vault: {
    adapter: {
      getFullPath(vaultPath) {
        if (!vaultPath) return "C:\\Obsidian";
        return path.win32.join("C:\\Obsidian", String(vaultPath).replace(/\//g, "\\"));
      },
    },
  },
  workspace: {
    onLayoutReady(callback) { callback(); },
    getLeavesOfType() { return []; },
    on(name, callback) {
      menuHandlers[name] = callback;
      return callback;
    },
  },
};

(async () => {
  const plugin = new PluginClass(app, { id: "open-folder-in-vscode" });
  await plugin.onload();
  assert(plugin.settings.ctrlClickSelection === false, "Ctrl selection defaults to off");
  const settingsTab = settingTabs.at(-1);
  settingsTab.display();
  assert(toggleControls.at(-1).value === false, "settings toggle defaults to off");
  await toggleControls.at(-1).change(true);
  assert(plugin.settings.ctrlClickSelection === true && savedData.ctrlClickSelection === true, "legacy toggle saves enabled option");
  const reloaded = new PluginClass(app, { id: "open-folder-in-vscode" });
  await reloaded.onload();
  assert(reloaded.settings.ctrlClickSelection === true, "Ctrl selection survives reload");
  assert(settingsTab.getSettingDefinitions().some((setting) => setting.control.key === "ctrlClickSelection" && setting.control.type === "toggle"), "declarative settings include the toggle");
  await settingsTab.setControlValue("ctrlClickSelection", false);
  assert(settingsTab.getControlValue("ctrlClickSelection") === false && savedData.ctrlClickSelection === false, "declarative toggle saves disabled option");
  await settingsTab.setControlValue("ctrlClickSelection", "true");
  assert(plugin.settings.ctrlClickSelection === false, "ignore invalid toggle values");
  savedData = { executable: "C:\\custom\\Code.exe" };
  const upgraded = new PluginClass(app, { id: "open-folder-in-vscode" });
  await upgraded.onload();
  assert(upgraded.settings.ctrlClickSelection === false && upgraded.settings.executable === savedData.executable, "existing settings retain path and default Ctrl off");
  savedData = null;
  await plugin.onload();
  assert(typeof menuHandlers["file-menu"] === "function", "file menu handler registered");
  assert(typeof menuHandlers["files-menu"] === "function", "files menu handler registered");

  function collectMenu(handler, payload) {
    const items = [];
    const menu = {
      addItem(callback) {
        const item = {
          setTitle(title) {
            this.title = title;
            return this;
          },
          setIcon() {
            return this;
          },
          onClick(fn) {
            this.click = fn;
            return this;
          },
        };
        callback(item);
        items.push(item);
        return menu;
      },
    };
    handler(menu, payload);
    return items;
  }

  function openMenu(file) {
    return collectMenu(menuHandlers["file-menu"], file);
  }

  function openFilesMenu(files) {
    return collectMenu(menuHandlers["files-menu"], files);
  }

  async function flush() {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  }

  language = "ko";
  plugin.settings.executable = "C:\\Program Files\\Microsoft VS Code\\Code.exe";
  const folderItems = openMenu(new obsidian.TFolder("25. DutyFlow_Growth"));
  assert(folderItems.length === 1, "folder menu has one item");
  assert(folderItems[0].title === "VS Code로 열기", "folder menu title");
  folderItems[0].click();
  await flush();
  assert(launches.length === 1, "one launch");
  assert(launches[0].args.length === 1 && launches[0].args[0] === folder, "clicked folder path");
  assert(launches[0].options.shell === false, "click launch is not a shell");
  assert(String(launches[0].command).toLowerCase().endsWith("code.exe"), "stable Code.exe");

  language = "ja";
  assert(openMenu(new obsidian.TFolder("a"))[0].title === "VS Codeで開く", "Japanese menu from plugin");
  language = "es";
  assert(openMenu(new obsidian.TFolder("a"))[0].title === "Abrir en VS Code", "Spanish menu from plugin");
  language = "en";
  assert(openMenu(new obsidian.TFolder("a"))[0].title === "Open in VS Code", "English menu from plugin");

  const fileItems = openMenu(new obsidian.TFile("note.md"));
  assert(fileItems.length === 0, "files do not get the menu item");

  plugin.settings.executable = "Z:\\missing\\Code.exe";
  const before = launches.length;
  openMenu(new obsidian.TFolder("25. DutyFlow_Growth"))[0].click();
  await flush();
  assert(launches.length === before, "missing custom path does not launch");
  assert(notices.at(-1) === i18n.translate("en", "pathMissing"), "missing path notice");

  language = "ko";
  plugin.settings.executable = "C:\\Program Files\\Microsoft VS Code\\Code.exe";
  const multiItems = openFilesMenu([
    new obsidian.TFolder("alpha"),
    new obsidian.TFile("note.md"),
    new obsidian.TFolder("beta"),
    new obsidian.TFolder("alpha"),
  ]);
  assert(multiItems.length === 1, "multi selection has one item");
  assert(multiItems[0].title === "VS Code로 열기", "multi menu title");
  multiItems[0].click();
  await flush();
  assert(launches.at(-1).args.length === 2, "duplicate folder dropped");
  assert(launches.at(-1).args[0] === "C:\\Obsidian\\alpha", "first selected folder");
  assert(launches.at(-1).args[1] === "C:\\Obsidian\\beta", "second selected folder");
  assert(launches.at(-1).options.shell === false, "multi launch is not a shell");
  assert(!launches.at(-1).args.includes("--new-window"), "multi launch has no new-window flag");

  assert(openFilesMenu([new obsidian.TFile("a.md"), new obsidian.TFile("b.md")]).length === 0, "files-only selection has no item");

  const oneInMulti = openFilesMenu([new obsidian.TFolder("25. DutyFlow_Growth")]);
  assert(oneInMulti.length === 1, "one folder in a multi menu still opens");
  oneInMulti[0].click();
  await flush();
  assert(launches.at(-1).args.length === 1 && launches.at(-1).args[0] === folder, "one folder in files-menu");

  missingDirs.add("C:\\Obsidian\\gone");
  const beforeMissingFolder = launches.length;
  openFilesMenu([new obsidian.TFolder("alpha"), new obsidian.TFolder("gone")])[0].click();
  await flush();
  assert(launches.length === beforeMissingFolder, "missing folder does not launch a partial workspace");
  assert(notices.at(-1) === i18n.translate("ko", "noPath"), "missing folder notice");
  missingDirs.delete("C:\\Obsidian\\gone");

  console.log("smoke ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
