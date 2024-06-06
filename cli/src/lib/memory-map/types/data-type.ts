import type { Option } from "nochoices";

import type { MemorySnapshot } from "../memory-snapshot";
import type {MemoryValue} from "../values/memory-value";

export interface MemoryDataType {
  extract(memory: MemorySnapshot, slot: bigint): Option<MemoryValue>;

  get evmSize(): number;
}