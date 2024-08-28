import { db } from "@/.server/db";
import { createOrIgnoreRecord, getFirst, getFirstOrThrow } from "@/.server/db/dto/utils/common";
import { proposalsTable } from "@/.server/db/schema";
import { type InferInsertModel, type InferSelectModel, eq } from "drizzle-orm";
import type { Hex } from "viem";

export async function createOrIgnoreProposal(
  data: InferInsertModel<typeof proposalsTable>,
  { tx }: { tx?: typeof db } = {}
) {
  await createOrIgnoreRecord(proposalsTable, data, { tx });
}

export async function getProposalByExternalId(externalId: Hex) {
  return getFirst(
    await db.select().from(proposalsTable).where(eq(proposalsTable.externalId, externalId))
  );
}

export async function updateProposal(
  data: Partial<InferInsertModel<typeof proposalsTable>> & {
    id: InferSelectModel<typeof proposalsTable>["id"];
  }
) {
  return getFirstOrThrow(
    await db.update(proposalsTable).set(data).where(eq(proposalsTable.id, data.id)).returning()
  );
}
