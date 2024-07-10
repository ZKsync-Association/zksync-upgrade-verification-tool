import { l1RpcProposals } from "@/.server/service/clients";
import {
  guardiansAbi,
  scAbi,
  upgradeHandlerAbi,
} from "@/.server/service/protocol-upgrade-handler-abi";
import { env } from "@config/env.server";
import { zodHex } from "validate-cli";
import type { Hex } from "viem";
import { z } from "zod";

const upgradeHandlerAddress = env.UPGRADE_HANDLER_ADDRESS;

const range = (l: number): number[] => new Array(l).fill(0).map((_, i) => i);

export async function guardiansAddress(): Promise<Hex> {
  return l1RpcProposals.contractRead(
    upgradeHandlerAddress,
    "guardians",
    upgradeHandlerAbi.raw,
    zodHex
  );
}

export async function councilAddress(): Promise<Hex> {
  return l1RpcProposals.contractRead(
    upgradeHandlerAddress,
    "securityCouncil",
    upgradeHandlerAbi.raw,
    zodHex
  );
}

export async function guardianMembers(): Promise<Hex[]> {
  return Promise.all(
    range(8).map(async (i) =>
      l1RpcProposals.contractRead(await guardiansAddress(), "members", guardiansAbi.raw, z.any(), [
        i,
      ])
    )
  );
}

export async function councilMembers(): Promise<Hex[]> {
  return Promise.all(
    range(12).map(async (i) =>
      l1RpcProposals.contractRead(await councilAddress(), "members", scAbi.raw, z.any(), [i])
    )
  );
}

export const UserRole = z.enum(["guardian", "security_council"]);
export type UserRole = z.infer<typeof UserRole>;

export async function isUserAuthorized(address: Hex) {
  const [guardianAddresses, scAddresses] = await Promise.all([guardianMembers(), councilMembers()]);

  const isGuardian = guardianAddresses.includes(address);
  const isSecurityCouncil = scAddresses.includes(address);

  if (isGuardian || isSecurityCouncil) {
    return {
      authorized: true,
      role: isGuardian ? UserRole.enum.guardian : UserRole.enum.security_council,
    } as const;
  }

  return {
    authorized: false,
    role: null,
  } as const;
}
