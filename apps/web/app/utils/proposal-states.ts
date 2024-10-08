import { z } from "zod";

export enum PROPOSAL_STATES {
  None = 0,
  LegalVetoPeriod = 1,
  Waiting = 2,
  ExecutionPending = 3,
  Ready = 4,
  Expired = 5,
  Done = 6,
}

export const ProposalStateSchema = z.nativeEnum(PROPOSAL_STATES);

export const isProposalActive = (status: PROPOSAL_STATES) =>
  status !== PROPOSAL_STATES.Expired && status !== PROPOSAL_STATES.Done;

export const isProposalInactive = (status: PROPOSAL_STATES) => !isProposalActive(status);

export enum EMERGENCY_PROPOSAL_STATUS {
  ACTIVE = 0,
  READY = 1,
  BROADCAST = 2,
  CLOSED = 3,
}

export type StatusTime = {
  totalDays: number;
  currentDay: number;
};
