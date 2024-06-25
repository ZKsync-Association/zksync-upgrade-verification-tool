import type { NewZkSyncEraDiff } from "../new-zk-sync-era-diff";
import type { ContractsRepo } from "../git-contracts-repo";
import CliTable from "cli-table3";
import type { BlockExplorer } from "../block-explorer-client";
import { HEX_ZKSYNC_FIELDS, NUMERIC_ZKSYNC_FIELDS } from "../current-zksync-era-state";

export interface CheckReportOptions {
  shortOutput: boolean
}

export class CheckReport {
  private diff: NewZkSyncEraDiff;
  private repo: ContractsRepo;
  private explorer: BlockExplorer;
  private opts: CheckReportOptions;

  constructor(diff: NewZkSyncEraDiff, repo: ContractsRepo, explorer: BlockExplorer, opts?: CheckReportOptions) {
    this.diff = diff;
    this.repo = repo;
    this.explorer = explorer;
    this.opts = opts || { shortOutput: true }
  }

  private long(): boolean {
    return !this.opts.shortOutput
  }

  private short(): boolean {
    return this.opts.shortOutput
  }

  async format(): Promise<string> {
    const lines: string[] = [];
    const warnings: string[] = [];

    await this.addHeader(lines);
    await this.addFacets(lines);
    await this.addFields(lines);
    await this.addSystemContracts(lines, warnings);
    await this.addWarnings(lines, warnings);

    return lines.join("\n");
  }

  private async addHeader(lines: string[]): Promise<void> {
    const title = "Upgrade metadata";
    lines.push(title);
    lines.push("=".repeat(title.length));

    const table = new CliTable({ head: ["Name", "Value"], style: { compact: true } });
    const [currentVersion, proposedVersion] = this.diff.protocolVersion();
    table.push(["Current version", currentVersion]);
    table.push(["Proposed version", proposedVersion]);
    table.push(["Taking l2 contracts from", "https://github.com/matter-labs/era-contracts"]);
    const gitSha = await this.repo.currentRef();
    const branch = await this.repo.currentBranch();
    const refValue = branch.map((b) => `${b} (${gitSha})`).unwrapOr(gitSha);
    table.push(["L2 contracts commit", refValue]);

    lines.push("", table.toString(), "", "");
  }

  private async addFacets(lines: string[]): Promise<void> {
    const facets = this.diff.addedFacets();
    facets.push(...this.diff.removedFacets());
    facets.push(...this.diff.upgradedFacets());
    if (facets.length === 0) {
      return;
    }

    this.addTitle(lines, "Facet changes");

    for (const facet of facets) {
      const table = new CliTable({ head: [facet.name] });

      table.push(["Old address", facet.oldAddress.map(this.formatHex).unwrapOr("")]);
      table.push(["New address", facet.newAddress.unwrapOr("Facet removed")]);

      if (facet.oldAddress.isSome()) {
        const oldAbi = await this.explorer.getAbi(facet.oldAddress.unwrap());
        table.push([
          "Removed functions",
          facet.removedSelectors.map((s) => oldAbi.signatureForSelector(s, this.long())).join("\n"),
        ]);
      } else {
        table.push(["Removed functions", "None"]);
      }

      if (facet.newAddress.isSome()) {
        const abi = await this.explorer.getAbi(facet.newAddress.unwrap());
        const newFunctions = facet.addedSelectors.map((s) => abi.signatureForSelector(s, this.long()));
        const preserved = facet.preservedSelectors.map((s) => abi.signatureForSelector(s, this.long()));
        table.push(["New functions", newFunctions.join("\n")]);
        table.push(["Upgraded functions", preserved.join("\n")]);
      } else {
        table.push(["New functions", "None"]);
        table.push(["Upgraded functions", "None"]);
      }

      lines.push("", table.toString(), "");
    }
  }

  private async addFields(lines: string[]): Promise<void> {
    this.addTitle(lines, "Contract fields");
    const table = new CliTable({ head: ["Field name", "Field Values"] });
    for (const field of HEX_ZKSYNC_FIELDS) {
      const [before, maybeAfter] = this.diff.hexAttrDiff(field);

      const after = maybeAfter
        .map((v) => this.formatHex(v))
        .unwrapOr("No changes.");
      table.push(
        [{ content: field, rowSpan: 2, vAlign: "center" }, `Current: ${this.formatHex(before)}`],
        [`Proposed: ${after}`]
      );
    }

    for (const field of NUMERIC_ZKSYNC_FIELDS) {
      const [before, maybeAfter] = this.diff.numberAttrDiff(field);

      const after = maybeAfter
        .map((v) => v.toString())
        .unwrapOr("No changes.");
      table.push(
        [{ content: field, rowSpan: 2, vAlign: "center" }, `Current: ${before}`],
        [`Proposed: ${after}`]
      );
    }

    lines.push(table.toString(), "");
  }

  private addTitle(lines: string[], title: string): void {
    lines.push(title);
    lines.push("=".repeat(title.length));
    lines.push("");
  }

  private async addSystemContracts(lines: string[], warnings: string[]) {
    const changes = await this.diff.systemContractChanges();

    if (changes.length === 0) {
      return;
    }

    this.addTitle(lines, "System contracts");

    const table = new CliTable({ head: ["System Contract", "Address", "Bytecode hash"] });

    for (const contract of changes) {
      const fromRepo = await this.repo.byteCodeHashFor(contract.name)
        .then(o => o.map(hash => this.formatHex(hash)));
      const bytecodeMatches = fromRepo.isSomeAnd((hash) => hash === contract.proposedBytecodeHash);
      if (!bytecodeMatches) {
        warnings.push(
          `Bytecode for "${contract.name}" does not match after recompile from sources`
        );
      }
      table.push(
        [
          { content: contract.name, rowSpan: 3, vAlign: "center" },
          { content: this.formatHex(contract.address), rowSpan: 3, vAlign: "center" },
          `Current: ${this.formatHex(contract.currentBytecodeHash)}`,
        ],
        [`Proposed: ${this.formatHex(contract.proposedBytecodeHash)}`],
        [`Bytecode hash match with sources: ${bytecodeMatches}`]
      );
    }

    lines.push(table.toString(), "");
  }

  private async addWarnings(lines: string[], warnings: string[]): Promise<void> {
    if (warnings.length === 0) {
      return;
    }

    this.addTitle(lines, "Warnings!");

    for (const warning of warnings) {
      lines.push(`⚠️ ${warning}`);
    }
    lines.push("");
  }

  private formatHex(hex: string): string {
    const formated = hex
      .toLowerCase()
      .replace("e", "E")
      .replace("d", "D");

    if (this.short() && formated.length > 2 + 10 * 2) {
      return `${formated.substring(0, 12)}...${formated.slice(-10)}`
    }
    return formated;
  }
}
