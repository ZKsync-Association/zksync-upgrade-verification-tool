import { z } from "zod";

export const ETHERSCAN_ENDPOINTS = {
  mainnet: "https://api.etherscan.io/api",
  sepolia: "https://api-sepolia.etherscan.io/api",
} as const;

export const NetworkSchema = z.enum(["mainnet", "sepolia"]);

export type Network = z.infer<typeof NetworkSchema>;

export const ADDRESS_ZERO = `0x${"0".repeat(40)}`;
export const ZERO_U256 = `0x${"0".repeat(64)}`;