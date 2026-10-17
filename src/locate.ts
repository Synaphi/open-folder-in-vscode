export interface DesktopIo {
  platform: string;
  env: Record<string, string | undefined>;
  exists: (filePath: string) => boolean;
  isDirectory: (filePath: string) => boolean;
  which: (command: string) => string | null;
  spawn: (
    command: string,
    args: string[],
    options: LaunchSpec["options"],
  ) => {
    on(event: "error", listener: () => void): void;
    unref(): void;
  };
  join: (...parts: string[]) => string;
  dirname: (filePath: string) => string;
  resolve: (...parts: string[]) => string;
}

export interface LaunchSpec {
  command: string;
  args: string[];
  options: {
    detached: true;
    stdio: "ignore";
    windowsHide: true;
    shell: false;
  };
}

function firstExisting(io: DesktopIo, candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (candidate && io.exists(candidate)) return candidate;
  }
  return null;
}

function windowsExeNearCmd(io: DesktopIo, found: string): string | null {
  if (io.platform !== "win32") return found;
  const lower = found.toLowerCase();
  if (!lower.endsWith(".cmd") && !lower.endsWith(".bat")) return found;
  const stable = io.resolve(io.dirname(found), "..", "Code.exe");
  if (io.exists(stable)) return stable;
  const insiders = io.resolve(io.dirname(found), "..", "Code - Insiders.exe");
  if (io.exists(insiders)) return insiders;
  return null;
}

function fromPath(io: DesktopIo, command: string): string | null {
  const found = io.which(command);
  if (!found) return null;
  return windowsExeNearCmd(io, found);
}

export function findExecutable(io: DesktopIo): string | null {
  const home = io.env.HOME || io.env.USERPROFILE || "";
  if (io.platform === "win32") {
    const local = io.env.LOCALAPPDATA;
    const programFiles = io.env.ProgramFiles;
    const programFilesX86 = io.env["ProgramFiles(x86)"];
    const stable = [
      local ? io.join(local, "Programs", "Microsoft VS Code", "Code.exe") : "",
      programFiles ? io.join(programFiles, "Microsoft VS Code", "Code.exe") : "",
      programFilesX86 ? io.join(programFilesX86, "Microsoft VS Code", "Code.exe") : "",
    ];
    const found = firstExisting(io, stable) ?? fromPath(io, "code");
    if (found) return found;
    const insiders = [
      local ? io.join(local, "Programs", "Microsoft VS Code Insiders", "Code - Insiders.exe") : "",
      programFiles ? io.join(programFiles, "Microsoft VS Code Insiders", "Code - Insiders.exe") : "",
    ];
    return firstExisting(io, insiders) ?? fromPath(io, "code-insiders");
  }

  if (io.platform === "darwin") {
    const stable = [
      "/usr/local/bin/code",
      "/opt/homebrew/bin/code",
      "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
      home
        ? io.join(home, "Applications", "Visual Studio Code.app", "Contents", "Resources", "app", "bin", "code")
        : "",
    ];
    return firstExisting(io, stable) ?? fromPath(io, "code");
  }

  const stable = [
    "/usr/bin/code",
    "/usr/local/bin/code",
    "/snap/bin/code",
    home ? io.join(home, ".local", "bin", "code") : "",
    home ? io.join(home, ".vscode", "bin", "code") : "",
  ];
  return firstExisting(io, stable) ?? fromPath(io, "code");
}

export function resolveConfigured(io: DesktopIo, configured: string): string | null {
  const trimmed = configured.trim();
  if (!trimmed) return findExecutable(io);
  if (!io.exists(trimmed)) return null;
  return windowsExeNearCmd(io, trimmed) ?? trimmed;
}

export function launchSpec(exe: string, folder: string): LaunchSpec {
  return {
    command: exe,
    args: [folder],
    options: {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      shell: false,
    },
  };
}

export interface PathAdapter {
  getFullPath?: (normalizedPath: string) => string;
  getBasePath?: () => string;
}

export function resolveFolder(adapter: object, vaultPath: string, io: DesktopIo | null): string | null {
  const reader = adapter as PathAdapter;
  if (typeof reader.getFullPath === "function") {
    const full = reader.getFullPath(vaultPath);
    if (full) return full;
  }
  if (!io || typeof reader.getBasePath !== "function") return null;
  const base = reader.getBasePath();
  if (!base) return null;
  if (!vaultPath) return base;
  return io.join(base, vaultPath);
}
