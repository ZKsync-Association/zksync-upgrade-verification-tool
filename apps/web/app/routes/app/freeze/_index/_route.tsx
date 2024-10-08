import { createFreezeProposal, getAllFreezeProposals } from "@/.server/db/dto/freeze-proposals";
import { isValidationError } from "@/.server/db/errors";
import type { freezeProposalsTable } from "@/.server/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateFreezeProposalModal } from "@/routes/app/freeze/_index/create-freeze-proposal-modal";
import { formError, generalError } from "@/utils/action-errors";
import { cn } from "@/utils/cn";
import type { ActionFunctionArgs } from "@remix-run/node";
import { Link, json, redirect, useLoaderData } from "@remix-run/react";
import type { InferSelectModel } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { $path } from "remix-routes";
import type { Jsonify } from "type-fest";
import { z } from "zod";
import { parseFormData } from "@/utils/read-from-request";
import { type FreezeProposalsType, FreezeProposalsTypeEnum } from "@/common/freeze-proposal-type";
import { securityCouncilAddress } from "@/.server/service/ethereum-l1/contracts/protocol-upgrade-handler";
import {
  securityCouncilHardFreezeNonce,
  securityCouncilSoftFreezeNonce,
  securityCouncilSoftFreezeThresholdSettingNonce,
  securityCouncilUnfreezeNonce,
} from "@/.server/service/ethereum-l1/contracts/security-council";

export async function loader() {
  const proposals = await getAllFreezeProposals();

  // Filter expired proposals
  const now = new Date();
  const validProposals = proposals.filter((p) => new Date(p.validUntil) > now);

  // Filter proposals already executed or ignored
  const securityCouncil = await securityCouncilAddress();
  const [softFreezeNonce, hardFreezeNonce, softFreezeThresholdSettingNonce, unfreezeNonce] =
    await Promise.all([
      securityCouncilSoftFreezeNonce(securityCouncil),
      securityCouncilHardFreezeNonce(securityCouncil),
      securityCouncilSoftFreezeThresholdSettingNonce(securityCouncil),
      securityCouncilUnfreezeNonce(securityCouncil),
    ]);

  const validAndActiveProposals = validProposals.filter((p) => {
    switch (p.type) {
      case "SOFT_FREEZE":
        return p.externalId >= softFreezeNonce;
      case "HARD_FREEZE":
        return p.externalId >= hardFreezeNonce;
      case "SET_SOFT_FREEZE_THRESHOLD":
        return p.externalId >= softFreezeThresholdSettingNonce;
      case "UNFREEZE":
        return p.externalId >= unfreezeNonce;
    }
  });

  return json({
    softFreezeProposals: validAndActiveProposals.filter((p) => p.type === "SOFT_FREEZE"),
    hardFreezeProposals: validAndActiveProposals.filter((p) => p.type === "HARD_FREEZE"),
    setSoftFreezeThresholdProposals: validAndActiveProposals.filter(
      (p) => p.type === "SET_SOFT_FREEZE_THRESHOLD"
    ),
    unfreezeProposals: validAndActiveProposals.filter((p) => p.type === "UNFREEZE"),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const parsed = parseFormData(
    await request.formData(),
    {
      validUntil: z.coerce.date().min(new Date()),
      threshold: z.coerce.number().min(1).max(9).nullable(),
      type: FreezeProposalsTypeEnum,
    },
    [
      {
        key: "threshold",
        check: (data) => data.type === "SET_SOFT_FREEZE_THRESHOLD" && data.threshold === null,
        message: () => "cannot be empty",
      },
      {
        key: "threshold",
        check: (data) => data.type !== "SET_SOFT_FREEZE_THRESHOLD" && data.threshold !== null,
        message: (data) => `${data.type} do not use threshold, but threshold was sent.`,
      },
    ]
  );

  if (parsed.errors) {
    return json(formError(parsed.errors));
  }

  const securityCouncil = await securityCouncilAddress();

  const data = parsed.data;

  let nonce: bigint;
  switch (data.type) {
    case "SOFT_FREEZE":
      nonce = await securityCouncilSoftFreezeNonce(securityCouncil);
      break;
    case "HARD_FREEZE":
      nonce = await securityCouncilHardFreezeNonce(securityCouncil);
      break;
    case "SET_SOFT_FREEZE_THRESHOLD":
      nonce = await securityCouncilSoftFreezeThresholdSettingNonce(securityCouncil);
      break;
    case "UNFREEZE":
      nonce = await securityCouncilUnfreezeNonce(securityCouncil);
      break;
  }

  let proposal: InferSelectModel<typeof freezeProposalsTable>;
  try {
    proposal = await createFreezeProposal({
      proposedOn: new Date(),
      type: data.type,
      softFreezeThreshold: data.threshold,
      validUntil: data.validUntil,
      externalId: nonce,
    });
  } catch (err) {
    if (isValidationError(err)) {
      return json(generalError("Pending proposal already exists."), 400);
    }
    throw err;
  }

  return redirect($path("/app/freeze/:id", { id: proposal.id }));
}

export default function Index() {
  const {
    softFreezeProposals,
    hardFreezeProposals,
    setSoftFreezeThresholdProposals,
    unfreezeProposals,
  } = useLoaderData<typeof loader>();
  return (
    <div className="space-y-4">
      <ProposalCard
        title="Soft Freeze Proposals"
        proposals={softFreezeProposals}
        type="SOFT_FREEZE"
        testNamespace="soft"
      />
      <ProposalCard
        title="Hard Freeze Proposals"
        proposals={hardFreezeProposals}
        type="HARD_FREEZE"
        testNamespace="hard"
      />
      <ProposalCard
        title="Set Soft Freeze Threshold Proposals"
        proposals={setSoftFreezeThresholdProposals}
        type="SET_SOFT_FREEZE_THRESHOLD"
        testNamespace="change-threshold"
      />
      <ProposalCard
        title="Unfreeze Proposals"
        proposals={unfreezeProposals}
        type="UNFREEZE"
        testNamespace="unfreeze"
      />
    </div>
  );
}

function ProposalCard({
  title,
  proposals,
  type,
  className,
  testNamespace,
}: {
  title: string;
  proposals: Jsonify<InferSelectModel<typeof freezeProposalsTable>>[];
  type: FreezeProposalsType;
  className?: string;
  testNamespace: string;
}) {
  return (
    <Card className={cn("pb-10", className)} data-testid={`${testNamespace}-card`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <CreateFreezeProposalModal type={type} testNamespace={testNamespace} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4" data-testid={`${testNamespace}-proposals`}>
          {proposals.map((proposal) => {
            const validUntil = new Date(proposal.validUntil).toLocaleString();

            return (
              <Link
                key={proposal.id}
                className="flex"
                to={$path("/app/freeze/:id", { id: proposal.id })}
              >
                <Button className="flex flex-1 justify-between pr-4" variant="outline">
                  <div className="flex items-center">
                    <span className="text-base">Proposal {proposal.externalId}</span>
                    <Badge className="ml-4" variant="secondary">
                      Valid until: {validUntil}
                    </Badge>
                  </div>
                  <ArrowRight />
                </Button>
              </Link>
            );
          })}
        </div>
        {proposals.length === 0 && (
          <div className="text-center text-gray-500">No proposals found.</div>
        )}
      </CardContent>
    </Card>
  );
}
