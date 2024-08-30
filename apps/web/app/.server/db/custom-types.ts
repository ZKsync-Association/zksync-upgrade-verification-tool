import { customType } from "drizzle-orm/pg-core";
import type { Hex } from "viem";
import { z } from "zod";

const hexSchema = z.string().regex(/^0x[0-9a-fA-F]*$/);
export type HexString = z.infer<typeof hexSchema>;
export const AddressSchema = hexSchema.length(42);
export type AddressHex = z.infer<typeof AddressSchema>;

export const bytea = customType<{
  data: Hex;
  driverData: Buffer;
}>({
  dataType() {
    return "bytea";
  },
  toDriver(val) {
    const parsed = hexSchema.parse(val);
    const hex = parsed.slice(2);
    // Avoid sending odd lengths. When length is odd Buffer.from ignores the first digit.
    const prefix = hex.length % 2 === 0 ? "" : "0";
    return Buffer.from(`${prefix}${hex}`, "hex");
  },
  fromDriver(val) {
    const hex = `0x${val.toString("hex")}`;
    return hexSchema.parse(hex) as Hex;
  },
});
