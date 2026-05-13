import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BudgetBar from "./BudgetBar";

describe("BudgetBar", () => {
  it("renders budget values", () => {
    render(<BudgetBar used={1.5} limit={10} turns={5} maxTurns={50} />);
    expect(screen.getByText(/\$1\.50/)).toBeInTheDocument();
    expect(screen.getByText(/\/ \$10\.00/)).toBeInTheDocument();
  });

  it("renders turn values", () => {
    render(<BudgetBar used={1} limit={10} turns={25} maxTurns={100} />);
    expect(screen.getByText(/25 \/ 100/)).toBeInTheDocument();
  });

  it("shows warning when budget exceeds 80%", () => {
    render(<BudgetBar used={9} limit={10} turns={5} maxTurns={50} />);
    expect(screen.getByText("资源消耗接近上限")).toBeInTheDocument();
  });

  it("shows warning when turns exceed 80%", () => {
    render(<BudgetBar used={1} limit={10} turns={45} maxTurns={50} />);
    expect(screen.getByText("资源消耗接近上限")).toBeInTheDocument();
  });

  it("hides warning when usage is low", () => {
    render(<BudgetBar used={1} limit={10} turns={5} maxTurns={50} />);
    expect(screen.queryByText("资源消耗接近上限")).not.toBeInTheDocument();
  });
});
