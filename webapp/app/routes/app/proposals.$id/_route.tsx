import { getProposalByExternalId } from "@/.server/db/dto/proposals";
import { getSignaturesByExternalProposalId } from "@/.server/db/dto/signatures";
import { actionSchema } from "@/.server/db/schema";
import { councilAddress, guardiansAddress } from "@/.server/service/authorized-users";
import { getProposalData, getProposalStatus } from "@/.server/service/proposals";
import { getCheckReport, getStorageChangeReport } from "@/.server/service/reports";
import { validateAndSaveSignature } from "@/.server/service/signatures";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Loading from "@/components/ui/loading";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { displayBytes32 } from "@/routes/app/proposals.$id/common-tables";
import ContractWriteButton from "@/routes/app/proposals.$id/contract-write-button";
import ContractWriteButton2 from "@/routes/app/proposals.$id/contract-write-button-2";
import FacetChangesTable from "@/routes/app/proposals.$id/facet-changes-table";
import FieldChangesTable from "@/routes/app/proposals.$id/field-changes-table";
import FieldStorageChangesTable from "@/routes/app/proposals.$id/field-storage-changes-table";
import SignButton from "@/routes/app/proposals.$id/sign-button";
import SystemContractChangesTable from "@/routes/app/proposals.$id/system-contract-changes-table";
import { requireUserFromHeader } from "@/utils/auth-headers";
import { cn } from "@/utils/cn";
import { compareHexValues } from "@/utils/compare-hex-values";
import { getTransactionUrl } from "@/utils/etherscan";
import { badRequest, notFound } from "@/utils/http";
import { PROPOSAL_STATES } from "@/utils/proposal-states";
import { env } from "@config/env.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { defer, json } from "@remix-run/node";
import { Await, useLoaderData, useNavigate } from "@remix-run/react";
import { ArrowLeft, SquareArrowOutUpRight } from "lucide-react";
import { Suspense } from "react";
import { getFormData, getParams } from "remix-params-helper";
import { zodHex } from "validate-cli";
import { type Hex, isAddressEqual, zeroAddress } from "viem";
import { z } from "zod";

export async function loader({ request, params: remixParams }: LoaderFunctionArgs) {
  const user = requireUserFromHeader(request);

  const params = getParams(remixParams, z.object({ id: zodHex }));
  if (!params.success) {
    throw notFound();
  }

  // Id is external_id coming from the smart contract
  const proposal = await getProposalByExternalId(params.data.id);
  if (!proposal) {
    throw notFound();
  }

  const getAsyncData = async () => {
    const checkReport = await getCheckReport(params.data.id);
    const storageChangeReport = await getStorageChangeReport(params.data.id);
    const [guardians, council, proposalStatus, signatures, proposalData] = await Promise.all([
      guardiansAddress(),
      councilAddress(),
      getProposalStatus(params.data.id),
      getSignaturesByExternalProposalId(params.data.id),
      getProposalData(params.data.id),
    ]);
    const upgradeHandler = env.UPGRADE_HANDLER_ADDRESS;

    return {
      proposal: {
        currentVersion: checkReport.metadata.currentVersion,
        proposedVersion: checkReport.metadata.proposedVersion,
        proposedOn: proposal.proposedOn,
        executor: proposal.executor,
        status: proposalStatus,
        extendedLegalVeto: proposalData.guardiansExtendedLegalVeto,
        approvedByGuardians: proposalData.guardiansApproval,
        approvedByCouncil: proposalData.securityCouncilApprovalTimestamp !== 0,
        guardiansApproval: proposalData.guardiansApproval,
        guardiansExtendedLegalVeto: proposalData.guardiansExtendedLegalVeto,
        raw: proposal.calldata,
        signatures: {
          extendLegalVetoPeriod: signatures
            .filter((signature) => signature.action === "ExtendLegalVetoPeriod")
            .sort((a, b) => compareHexValues(a.signer, b.signer)),
          approveUpgradeGuardians: signatures
            .filter((signature) => signature.action === "ApproveUpgradeGuardians")
            .sort((a, b) => compareHexValues(a.signer, b.signer)),
          approveUpgradeSecurityCouncil: signatures
            .filter((signature) => signature.action === "ApproveUpgradeSecurityCouncil")
            .sort((a, b) => compareHexValues(a.signer, b.signer)),
        },
        transactionHash: proposal.transactionHash,
      },
      reports: {
        facetChanges: checkReport.facetChanges,
        systemContractChanges: checkReport.systemContractChanges,
        fieldChanges: checkReport.fieldChanges,
        fieldStorageChanges: storageChangeReport,
      },
      addresses: { guardians, council, upgradeHandler },
      userSignedProposal: signatures
        .filter((s) =>
          user.role === "guardian"
            ? s.action === "ApproveUpgradeGuardians"
            : s.action === "ApproveUpgradeSecurityCouncil"
        )
        .some((s) => isAddressEqual(s.signer as Hex, user.address as Hex)),
      userSignedLegalVeto: signatures
        .filter((s) => s.action === "ExtendLegalVetoPeriod")
        .some((s) => isAddressEqual(s.signer as Hex, user.address as Hex)),
    };
  };

  return defer({
    user,
    proposalId: proposal.externalId as Hex,
    asyncData: getAsyncData(),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = requireUserFromHeader(request);
  const data = await getFormData(
    request,
    z.object({
      signature: zodHex,
      proposalId: zodHex,
      actionName: actionSchema,
    })
  );
  if (!data.success) {
    throw badRequest("Failed to parse signature data");
  }

  await validateAndSaveSignature(
    data.data.signature,
    user.address as Hex,
    data.data.actionName,
    data.data.proposalId
  );
  return json({ ok: true });
}

const NECESSARY_SECURITY_COUNCIL_SIGNATURES = 6;
const NECESSARY_GUARDIAN_SIGNATURES = 5;
const NECESSARY_LEGAL_VETO_SIGNATURES = 2;

export default function Proposals() {
  const { user, asyncData, proposalId } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div className="mt-10 flex flex-1 flex-col space-y-4">
      <div className="flex items-center pl-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mr-2 hover:bg-transparent"
        >
          <ArrowLeft />
        </Button>
        <h2 className="font-semibold">Proposal {displayBytes32(proposalId)}</h2>
      </div>

      <Suspense
        fallback={
          <div className="flex flex-1 flex-col items-center justify-center space-y-6">
            <Loading />
            <h2>Loading proposal...</h2>
          </div>
        }
      >
        <Await resolve={asyncData}>
          {({ addresses, proposal, reports, userSignedLegalVeto, userSignedProposal }) => {
            const securityCouncilSignaturesReached =
              proposal.signatures.approveUpgradeSecurityCouncil.length >=
              NECESSARY_SECURITY_COUNCIL_SIGNATURES;
            const guardiansSignaturesReached =
              proposal.signatures.approveUpgradeGuardians.length >= NECESSARY_GUARDIAN_SIGNATURES;

            const signProposalEnabled =
              !userSignedProposal &&
              proposal.status === PROPOSAL_STATES.Waiting &&
              (user.role === "guardian" ? !proposal.guardiansApproval : true);
            const signLegalVetoEnabled =
              !userSignedLegalVeto &&
              !proposal.guardiansExtendedLegalVeto &&
              proposal.status === PROPOSAL_STATES.LegalVetoPeriod &&
              user.role === "guardian";

            const executeSecurityCouncilApprovalEnabled =
              proposal.status === PROPOSAL_STATES.Waiting && securityCouncilSignaturesReached;
            const executeGuardiansApprovalEnabled =
              !proposal.guardiansApproval &&
              proposal.status === PROPOSAL_STATES.Waiting &&
              guardiansSignaturesReached;
            const executeLegalVetoExtensionEnabled =
              !proposal.extendedLegalVeto && proposal.status === PROPOSAL_STATES.LegalVetoPeriod;
            const executeProposalEnabled =
              proposal.status === PROPOSAL_STATES.Ready &&
              (isAddressEqual(proposal.executor as Hex, user.address as Hex) ||
                isAddressEqual(proposal.executor as Hex, zeroAddress));

            return (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card className="pb-10">
                    <CardHeader>
                      <CardTitle>Proposal Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="flex justify-between">
                          <span>Current Version:</span>
                          <span className="w-1/2 break-words text-right">
                            {proposal.currentVersion}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Proposed Version:</span>
                          <span className="w-1/2 break-words text-right">
                            {proposal.proposedVersion}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Proposal ID:</span>
                          <span className="w-1/2 justify-end break-words">{proposalId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Proposed On:</span>
                          <div className="flex w-1/2 flex-col break-words text-right">
                            <span>{new Date(proposal.proposedOn).toISOString()}</span>
                            <span>
                              ({Math.floor(new Date(proposal.proposedOn).getTime() / 1000)})
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span>Executor:</span>
                          <span className="w-1/2 break-words text-right">
                            {isAddressEqual(proposal.executor as `0x${string}`, zeroAddress)
                              ? "Anyone"
                              : proposal.executor}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Transaction hash:</span>
                          <a
                            href={getTransactionUrl(proposal.transactionHash as Hex)}
                            className="flex w-1/2 items-center justify-end break-words underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span>{displayBytes32(proposal.transactionHash)}</span>
                            <SquareArrowOutUpRight className="ml-1" width={12} height={12} />
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="pb-10">
                    <CardHeader className="pt-7">
                      {displayProposalState(proposal.status)}
                      <CardTitle>Proposal Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-5">
                        <StatusIndicator
                          label="Security Council Approvals"
                          signatures={proposal.signatures.approveUpgradeSecurityCouncil.length}
                          necessarySignatures={NECESSARY_SECURITY_COUNCIL_SIGNATURES}
                        />
                        <StatusIndicator
                          label="Guardian Approvals"
                          signatures={proposal.signatures.approveUpgradeGuardians.length}
                          necessarySignatures={NECESSARY_GUARDIAN_SIGNATURES}
                        />
                        <StatusIndicator
                          label="Extend Legal Veto Approvals"
                          signatures={proposal.signatures.extendLegalVetoPeriod.length}
                          necessarySignatures={NECESSARY_LEGAL_VETO_SIGNATURES}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="pb-10">
                    <CardHeader>
                      <CardTitle>
                        {user.role === "guardian" ? "Guardian" : "Security Council"} Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col space-y-3">
                      {user.role === "guardian" && (
                        <SignButton
                          proposalId={proposalId}
                          contractData={{
                            actionName: "ExtendLegalVetoPeriod",
                            address: addresses.guardians,
                            name: "Guardians",
                          }}
                          disabled={!signLegalVetoEnabled}
                        >
                          Approve extend veto period
                        </SignButton>
                      )}
                      {user.role === "guardian" && (
                        <SignButton
                          proposalId={proposalId}
                          contractData={{
                            actionName: "ApproveUpgradeGuardians",
                            address: addresses.guardians,
                            name: "Guardians",
                          }}
                          disabled={!signProposalEnabled}
                        >
                          Approve proposal
                        </SignButton>
                      )}
                      {user.role === "securityCouncil" && (
                        <SignButton
                          proposalId={proposalId}
                          contractData={{
                            actionName: "ApproveUpgradeSecurityCouncil",
                            address: addresses.council,
                            name: "SecurityCouncil",
                          }}
                          disabled={!signProposalEnabled}
                        >
                          Approve proposal
                        </SignButton>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="pb-10">
                    <CardHeader>
                      <CardTitle>Proposal Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col space-y-3">
                      <ContractWriteButton
                        target={addresses.council}
                        signatures={proposal.signatures.approveUpgradeSecurityCouncil}
                        proposalId={proposalId}
                        functionName={"approveUpgradeSecurityCouncil"}
                        abiName="council"
                        threshold={NECESSARY_SECURITY_COUNCIL_SIGNATURES}
                        disabled={!executeSecurityCouncilApprovalEnabled}
                      >
                        Execute security council approval
                      </ContractWriteButton>

                      <ContractWriteButton
                        target={addresses.guardians}
                        signatures={proposal.signatures.approveUpgradeGuardians}
                        proposalId={proposalId}
                        functionName={"approveUpgradeGuardians"}
                        abiName="guardians"
                        threshold={NECESSARY_GUARDIAN_SIGNATURES}
                        disabled={!executeGuardiansApprovalEnabled}
                      >
                        Execute guardian approval
                      </ContractWriteButton>

                      <ContractWriteButton
                        target={addresses.guardians}
                        signatures={proposal.signatures.extendLegalVetoPeriod}
                        proposalId={proposalId}
                        functionName={"extendLegalVeto"}
                        abiName="guardians"
                        threshold={NECESSARY_LEGAL_VETO_SIGNATURES}
                        disabled={!executeLegalVetoExtensionEnabled}
                      >
                        Execute legal veto extension
                      </ContractWriteButton>
                      <ContractWriteButton2
                        target={addresses.upgradeHandler}
                        proposalCalldata={proposal.raw}
                        disabled={!executeProposalEnabled}
                      >
                        Execute upgrade
                      </ContractWriteButton2>
                    </CardContent>
                  </Card>
                </div>
                <div className="pt-4">
                  <h2 className="font-bold text-3xl">Upgrade Analysis</h2>
                  <Tabs className="mt-4 flex" defaultValue="facet-changes">
                    <TabsList className="mt-12 mr-6">
                      <TabsTrigger value="facet-changes">Facet Changes</TabsTrigger>
                      <TabsTrigger value="system-contract-changes">
                        System Contract Changes
                      </TabsTrigger>
                      <TabsTrigger value="field-changes">Field Changes</TabsTrigger>
                      <TabsTrigger value="field-storage-changes">Field Storage Changes</TabsTrigger>
                    </TabsList>
                    <TabsContent value="facet-changes" className="w-full">
                      <Card className="pb-8">
                        <CardHeader>
                          <CardTitle>Facet Changes</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <FacetChangesTable data={reports.facetChanges} />
                        </CardContent>
                      </Card>
                    </TabsContent>
                    <TabsContent value="system-contract-changes" className="w-full">
                      <Card className="pb-8">
                        <CardHeader>
                          <CardTitle>System Contract Changes</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <SystemContractChangesTable data={reports.systemContractChanges} />
                        </CardContent>
                      </Card>
                    </TabsContent>
                    <TabsContent value="field-changes" className="w-full">
                      <Card className="pb-8">
                        <CardHeader>
                          <CardTitle>Field Changes</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <FieldChangesTable data={reports.fieldChanges} />
                        </CardContent>
                      </Card>
                    </TabsContent>
                    <TabsContent value="field-storage-changes" className="w-full">
                      <Card className="pb-8">
                        <CardHeader>
                          <CardTitle>Field Storage Changes</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <FieldStorageChangesTable data={reports.fieldStorageChanges} />{" "}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            );
          }}
        </Await>
      </Suspense>
    </div>
  );
}

function StatusIndicator({
  signatures,
  necessarySignatures,
  label,
}: { signatures: number; necessarySignatures: number; label: string }) {
  const necessarySignaturesReached = signatures >= necessarySignatures;

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <span>{label}</span>
        <span
          className={cn("text-muted-foreground", necessarySignaturesReached && "text-green-400")}
        >
          {signatures}/{necessarySignatures}
        </span>
      </div>
      <Progress
        indicatorClassName={cn(necessarySignaturesReached && "bg-green-500")}
        value={(signatures / necessarySignatures) * 100}
      />
    </div>
  );
}

function displayProposalState(state: PROPOSAL_STATES) {
  let color: string;
  let label: string;

  switch (state) {
    case PROPOSAL_STATES.None:
      color = "text-red-400";
      label = "NONE";
      break;
    case PROPOSAL_STATES.LegalVetoPeriod:
      color = "text-yellow-400";
      label = "LEGAL VETO PERIOD";
      break;
    case PROPOSAL_STATES.Waiting:
      color = "text-yellow-400";
      label = "WAITING";
      break;
    case PROPOSAL_STATES.ExecutionPending:
      color = "text-yellow-400";
      label = "EXECUTION PENDING";
      break;
    case PROPOSAL_STATES.Ready:
      color = "text-green-400";
      label = "READY";
      break;
    case PROPOSAL_STATES.Expired:
      color = "text-red-400";
      label = "EXPIRED";
      break;
    case PROPOSAL_STATES.Done:
      color = "text-green-400";
      label = "DONE";
      break;
  }

  return <p className={color}>{label}</p>;
}
