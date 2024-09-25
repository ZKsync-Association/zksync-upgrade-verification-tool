import { type Address, type Hex, hexToBigInt } from "viem";
import { readFileSync } from "fs";
import { z } from "zod";
import { addressSchema, hexSchema } from "@repo/common/schemas";

const schema = z.object({
  calls: z.array(z.object({
    value: hexSchema.transform(hex => hexToBigInt(hex)),
    data: hexSchema,
    target: addressSchema
  })),
  executor: addressSchema,
  salt: hexSchema
})


type RawCall = {
  value: bigint;
  data: Hex;
  target: Address;
}

export class UpgradeFile {
  calls: RawCall[];
  executor: Hex;
  salt: Hex;

  constructor(calls: RawCall[], executor: Hex, salt: Hex) {
    this.calls = calls;
    this.executor = executor;
    this.salt = salt;
  }

  static fromFile(path: string) {
    const buff = readFileSync(path)
    const obj = JSON.parse(buff.toString());
    const parsed = schema.parse(obj)
    return new this(parsed.calls, parsed.executor, parsed.salt);
  }
}