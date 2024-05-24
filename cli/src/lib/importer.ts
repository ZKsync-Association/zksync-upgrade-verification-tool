import fs from "node:fs/promises";
import path from "node:path";
import {
  commonJsonSchema,
  type FacetsJson, facetsSchema,
  type L2UpgradeJson, l2UpgradeSchema, transactionsSchema,
} from "../schema";
import type { Network } from "./constants";
import { MissingNetwork, NotAnUpgradeDir } from "./errors.js";
import { UpgradeChanges } from "./upgrade-changes";
import type { FileSystem } from "./file-system";

const POSSIBLE_DIRS_PER_NETWORK = {
  mainnet: ["mainnet", "mainnet2"],
  sepolia: ["testnet-sepolia", "testnet"]
}

export class UpgradeImporter {
  private fs: FileSystem;

  constructor(fs: FileSystem) {
    this.fs = fs
  }

  private possibleDirNamesFor(network: Network): string[] {
    return POSSIBLE_DIRS_PER_NETWORK[network]
  }

  private async findNetworkDir(baseDir: string, network: Network): Promise<string> {
    const possibleNetworkDirs = this.possibleDirNamesFor(network);
    for (const possibleDir of possibleNetworkDirs) {
      const fullNetworkDir = path.join(baseDir, possibleDir);
      if (await this.fs.directoryExists(fullNetworkDir)) {
        return fullNetworkDir
      }
    }
    throw new MissingNetwork(baseDir, network);
  }

  async readFromFiles(upgradeDirectory: string, network: Network): Promise<UpgradeChanges> {
    const targetDir = path.resolve(process.cwd(), upgradeDirectory);
    const networkDir = await this.findNetworkDir(targetDir, network)

    await this.fs.assertDirectoryExists(targetDir, upgradeDirectory);
    await this.fs.assertDirectoryExists(targetDir, networkDir);

    const common = await fs.readFile(path.join(targetDir, 'common.json'))
      .catch(() => { throw new NotAnUpgradeDir(upgradeDirectory)})
      .then(buf => commonJsonSchema.parse(JSON.parse(buf.toString())))
    const transactions = await fs.readFile(path.join(networkDir, 'transactions.json'))
      .then(buf => transactionsSchema.parse(JSON.parse(buf.toString())))

    const facets: FacetsJson | undefined = await fs.readFile(path.join(networkDir, 'facets.json'))
      .then(
        (buf) => facetsSchema.parse(JSON.parse(buf.toString())),
        () => undefined
      )

    const l2Upgrade: L2UpgradeJson | undefined = await fs.readFile(path.join(networkDir, 'l2Upgrade.json'))
      .then(
        (buf) => l2UpgradeSchema.parse(JSON.parse(buf.toString())),
      )

    return UpgradeChanges.fromFiles(
      common,
      transactions,
      facets,
      l2Upgrade
    )
  }
}