import { db } from "@/.server/db";
import { createOrIgnoreRecord } from "@/.server/db/dto/utils/common";
import { type proposalsTable, signaturesTable } from "@/.server/db/schema";
import { type InferInsertModel, type InferSelectModel, eq } from "drizzle-orm";

export async function createOrIgnoreSignature(
  data: InferInsertModel<typeof signaturesTable>,
  { tx }: { tx?: typeof db } = {}
): Promise<void> {
  await createOrIgnoreRecord(signaturesTable, data, { tx });
}

export async function getSignaturesByExternalProposalId(
  id: InferSelectModel<typeof proposalsTable>["externalId"]
) {
  return await db.select().from(signaturesTable).where(eq(signaturesTable.proposal, id));
}
