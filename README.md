# Open Folder in VS Code

Right-click a folder in the Obsidian file explorer and choose **Open in VS Code**. Visual Studio Code opens with that folder as the workspace.

The menu label follows Obsidian's display language. Every language in the [Obsidian app language list](https://github.com/obsidianmd/obsidian-translations#existing-languages) has its own strings, including Korean, English, Japanese, and Spanish. An unknown language falls back to English.

This plugin is desktop-only. On Windows, macOS, and Linux it looks for a standard Visual Studio Code install, then for the `code` command on `PATH`. If the install lives somewhere else, set the executable path in the plugin settings. Leave that field empty to keep automatic detection.

## Install

Install **Open Folder in VS Code** from Obsidian Community plugins, then enable it.

Manual install: download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Synaphi/open-folder-in-vscode/releases) into `.obsidian/plugins/open-folder-in-vscode/`, then enable the plugin.

## Develop

```bash
npm install
npm test
```

`npm test` typechecks, builds `main.js`, and runs the menu, language, and launch-argument checks. It does not open a VS Code window.
