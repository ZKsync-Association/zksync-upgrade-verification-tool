import fs from "node:fs/promises";
import { NotADir } from "./errors.js";
import type { Stats } from "node:fs";
import path from "node:path";
import os from "node:os";

export async function directoryExists(path: string): Promise<boolean> {
  let targetDirStat: Stats;
  try {
    targetDirStat = await fs.stat(path);
  } catch (_e) {
    return false;
  }
  return targetDirStat.isDirectory();
}

export async function assertDirectoryExists(
  path: string,
  originalPath: string = path
): Promise<void> {
  if (!(await directoryExists(path))) {
    throw new NotADir(originalPath);
  }
}

export async function cacheDir(): Promise<string> {
  const cacheDir = path.join(os.homedir(), ".cache", "zksync-era-validate");

  await fs.mkdir(cacheDir, { recursive: true });
  return cacheDir;
}
