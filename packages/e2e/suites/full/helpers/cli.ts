import { exec as execSync, spawn, type ChildProcess } from "node:child_process";
import util from "node:util";
import fs from "node:fs";
import path from "node:path";

export const exec = util.promisify(execSync);

export function spawnBackground(
  command: string,
  { cwd, env, outputFile }: { cwd?: string; env?: Record<string, string>; outputFile?: string } = {}
): { pid: number | undefined; kill: () => void } {
  let fileStream: number | undefined;

  if (outputFile) {
    const outputDir = path.dirname(outputFile);
    fs.mkdirSync(outputDir, { recursive: true });

    if (fs.existsSync(outputFile)) {
      fs.truncateSync(outputFile, 0);
    }

    fileStream = fs.openSync(outputFile, "a");
  }

  const stdio = fileStream ? ["ignore", fileStream, fileStream] : "ignore";
  const [cmd, ...cmdArgs] = command.split(/\s+/);
  if (!cmd) {
    throw new Error("Command is required");
  }

  const process: ChildProcess = spawn(cmd, cmdArgs, {
    cwd,
    stdio: stdio as any,
    detached: true,
    env,
  });

  process.unref();

  return {
    pid: process.pid,
    kill: () => {
      process.kill();
    },
  };
}

export async function killProcessByPort(port: number) {
  const pids = await getPidFromPort(port);
  if (!pids) {
    return;
  }

  for (const p of pids) {
    process.kill(p);
  }
}

export async function getPidFromPort(port: number) {
  try {
    const process = await exec(`lsof -t -i :${port}`);
    const output = process.stdout.trim();

    // Output can be a list of pids
    const pids = output.split("\n");

    return pids.map(Number);
  } catch {
    return null;
  }
}