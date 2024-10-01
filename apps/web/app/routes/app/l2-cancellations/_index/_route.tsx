import { getUpdatedL2Cancellations } from "@/.server/service/l2-cancellations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusIcon } from "@radix-ui/react-icons";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { ArrowRight } from "lucide-react";
import { $path } from "remix-routes";

export async function loader() {
  const proposals = await getUpdatedL2Cancellations();

  const isActive = (p: (typeof proposals)[number]) => p.status === "ACTIVE" && !p.archivedOn;
  const isInactive = (p: (typeof proposals)[number]) => !isActive(p);

  return json({
    activeProposals: proposals.filter(isActive),
    inactiveProposals: proposals.filter(isInactive),
  });
}

export default function L2Proposals() {
  const { activeProposals, inactiveProposals } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-4">
      <Card className="pb-10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Active L2 Veto Proposals</CardTitle>
            <Link to={$path("/app/l2-cancellations/new")}>
              <Button data-testid="new-cancellation-proposal" variant="secondary" size="icon">
                <PlusIcon className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {activeProposals.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeProposals.length > 0 &&
                  activeProposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell>{proposal.description}</TableCell>
                      <TableCell>
                        <Link to={$path("/app/l2-cancellations/:id", { id: proposal.externalId })}>
                          <Button variant="outline" size="sm">
                            View
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
          {activeProposals.length === 0 && (
            <div className="text-center text-gray-500">No veto proposals found.</div>
          )}
        </CardContent>
      </Card>
      <Card className="pb-10">
        <CardHeader>
          <CardTitle>Inactive L2 Veto Proposals</CardTitle>
        </CardHeader>
        <CardContent>
          {inactiveProposals.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveProposals.length > 0 &&
                  inactiveProposals.map((proposal) => (
                    <TableRow key={proposal.id}>
                      <TableCell>{proposal.description}</TableCell>
                      <TableCell>
                        {proposal.archivedOn !== null ? "Archived" : "Inactive"}
                      </TableCell>
                      <TableCell>
                        <Link to={$path("/app/l2-cancellations/:id", { id: proposal.externalId })}>
                          <Button variant="outline" size="sm">
                            View
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
          {inactiveProposals.length === 0 && (
            <div className="text-center text-gray-500">No veto proposals found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
