import {
  EMERGENCY_BOARD_ABI,
  GUARDIANS_RAW_ABI,
  PROTOCOL_UPGRADE_HANDLER_RAW_ABI,
  SEC_COUNCIL_RAW_ABI,
} from "@/utils/raw-abis";
import { ContractAbi } from "validate-cli";

export const upgradeHandlerAbi = new ContractAbi(PROTOCOL_UPGRADE_HANDLER_RAW_ABI);
export const guardiansAbi = new ContractAbi(GUARDIANS_RAW_ABI);
export const scAbi = new ContractAbi(SEC_COUNCIL_RAW_ABI);
export const emergencyBoardAbi = new ContractAbi(EMERGENCY_BOARD_ABI);
