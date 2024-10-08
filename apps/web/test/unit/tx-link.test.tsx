import TxLink from "@/components/tx-link";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import "@testing-library/jest-dom";

vi.mock("@/utils/etherscan", () => ({
  getTransactionUrl: vi.fn(),
}));

vi.mock("@/routes/app/proposals/$id/common-tables", () => ({
  displayBytes32: vi.fn((txid) => `${txid.slice(0, 10)}...${txid.slice(-8)}`),
}));

describe("TxLink", () => {
  const mockTxid = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

  it("renders the transaction link correctly", () => {
    render(<TxLink hash={mockTxid} url="https://example.com/tx/mock" />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com/tx/mock");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");

    const displayedTx = screen.getByText("0x12345678...7890abcdef");
    expect(displayedTx).toBeInTheDocument();

    const icon = screen.getByTestId("square-arrow-out-up-right-icon");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("width", "12");
    expect(icon).toHaveAttribute("height", "12");
  });
});
