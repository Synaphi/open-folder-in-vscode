<a href="assets/banner.png"><img src="assets/banner.png" alt="Open Folder in VS Code — right-click a folder and open it in Visual Studio Code"></a>

# Open Folder in VS Code

A very lightweight program. It adds one menu item, with no indexing, network requests, or background jobs.

Right-click a folder in the file explorer and open that folder in Visual Studio Code.

**One job, done well.** No background work and no extra views. The folder you clicked becomes the workspace. Not the whole vault, and not the note you had open.

## Why you'll like it

- **Very light.** One context-menu item. It does not index notes, watch files, or talk to the network.
- **The folder under the pointer.** One right-click, and Visual Studio Code opens with that folder as the workspace.
- **Several folders, one window.** Alt-click folder names to add or remove them from the selection without expanding or collapsing them. Shift-click selects a range. Then use the same command to open them together as one multi-root workspace.
- **Files stay put.** Notes in the selection are skipped. A folder selected twice is opened once. If one selected folder has no local path, nothing opens.
- **It finds Visual Studio Code.** A standard install, then the `code` command. Set a path in settings if the install lives somewhere else. A missing path is reported. It does not guess another one.
- **Your language.** The menu follows the display language. Korean, Japanese, Spanish, and the rest of the app language list are included. An unknown language falls back to English.

## How to use

1. In the file explorer, right-click a folder.
2. Choose **Open in VS Code** (한국어: **VS Code로 열기**).
3. To open more than one folder, hold **Alt** and click each folder name (use **Shift-click** for a range), then right-click a selected folder and use the same command.

Prefer Ctrl-click? In **Settings → Open Folder in VS Code**, enable **Select folders with Ctrl-click** (한국어: **Ctrl+클릭으로도 폴더 다중 선택**). This option is **off by default**. When enabled, Ctrl-click adds or removes folders from the selection without expanding or collapsing them. Alt-click continues to work, and Ctrl+Shift-click selects a range.

Desktop only. Windows, macOS, and Linux.

## Install

Install **Open Folder in VS Code** from Community plugins, then enable it.

Manual install: download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Synaphi/open-folder-in-vscode/releases) into `.obsidian/plugins/open-folder-in-vscode/`, then enable the plugin.

## Develop

```bash
npm install
npm test
```

`npm test` typechecks, builds `main.js`, and runs the menu, language, and launch-argument checks. It does not open a Visual Studio Code window.

The banner is rendered from `assets/banner-source.html` with headless Chrome at 1280×600, scale 2.

## License

MIT
