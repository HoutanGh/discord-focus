import { cp, mkdir, rm, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { buildAll } from "./build.mjs";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const exportFolderName = "DiscordFocusBuild";

function isWindowsPath(value) {
  return /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\");
}

async function commandOutput(command, args) {
  const { stdout } = await execFileAsync(command, args, {
    windowsHide: true
  });
  return stdout.trim();
}

async function resolveBaseDir() {
  const requested = process.env.WINDOWS_DIST_DIR;
  if (requested && isWindowsPath(requested)) {
    return commandOutput("wslpath", ["-u", requested]);
  }
  if (requested) {
    return path.resolve(requested);
  }

  const localAppData = await commandOutput("powershell.exe", [
    "-NoProfile",
    "-Command",
    "[Environment]::GetFolderPath('LocalApplicationData')"
  ]);
  return commandOutput("wslpath", ["-u", localAppData]);
}

async function toWindowsPath(wslPath) {
  try {
    return await commandOutput("wslpath", ["-w", wslPath]);
  } catch {
    return wslPath;
  }
}

async function copyBrowserBuild(browserName, destinationRoot) {
  const source = path.join(distDir, browserName);
  const target = path.join(destinationRoot, browserName);

  if (path.dirname(target) !== destinationRoot || !["firefox", "chrome"].includes(path.basename(target))) {
    throw new Error(`Refusing to replace unsafe destination: ${target}`);
  }

  await stat(path.join(source, "manifest.json"));
  await rm(target, { recursive: true, force: true });
  await cp(source, target, { recursive: true });
  await stat(path.join(target, "manifest.json"));
  return target;
}

export async function exportWindows() {
  await buildAll();

  const baseDir = await resolveBaseDir();
  const destinationRoot = path.join(baseDir, exportFolderName);

  if (!path.isAbsolute(destinationRoot) || path.basename(destinationRoot) !== exportFolderName) {
    throw new Error(`Invalid export destination: ${destinationRoot}`);
  }

  await mkdir(destinationRoot, { recursive: true });

  const firefoxPath = await copyBrowserBuild("firefox", destinationRoot);
  const chromePath = await copyBrowserBuild("chrome", destinationRoot);
  const firefoxWindowsPath = await toWindowsPath(firefoxPath);
  const chromeWindowsPath = await toWindowsPath(chromePath);

  console.log(`Exported Firefox build: ${firefoxWindowsPath}`);
  console.log(`Exported Chrome build: ${chromeWindowsPath}`);

  return {
    firefoxPath,
    chromePath,
    firefoxWindowsPath,
    chromeWindowsPath
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await exportWindows();
}
