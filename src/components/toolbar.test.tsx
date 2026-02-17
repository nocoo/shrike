import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock next/image to avoid SSG image optimization issues in test
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, priority, ...rest } = props;
    void fill;
    void priority;
    return <img {...rest} />;
  },
}));

// Mock SettingsDialog to avoid Tauri dependency
vi.mock("@/components/settings-dialog", () => ({
  SettingsDialog: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="settings-dialog">{children}</div>
  ),
}));

import { Toolbar } from "./toolbar";

describe("Toolbar", () => {
  it("renders app title", () => {
    render(<Toolbar entryCount={0} onAdd={() => {}} />);
    expect(screen.getByText("Shrike")).toBeInTheDocument();
  });

  it("renders logo image", () => {
    render(<Toolbar entryCount={0} onAdd={() => {}} />);
    const logo = screen.getByAltText("Shrike");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/logo-64.png");
  });

  it("does not show count when entryCount is 0", () => {
    render(<Toolbar entryCount={0} onAdd={() => {}} />);
    expect(screen.queryByText(/item/)).not.toBeInTheDocument();
  });

  it("shows singular count for 1 item", () => {
    render(<Toolbar entryCount={1} onAdd={() => {}} />);
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });

  it("shows plural count for multiple items", () => {
    render(<Toolbar entryCount={5} onAdd={() => {}} />);
    expect(screen.getByText("5 items")).toBeInTheDocument();
  });

  it("calls onAdd when + button is clicked", () => {
    const onAdd = vi.fn();
    render(<Toolbar entryCount={0} onAdd={onAdd} />);

    // The first button should be the + button
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);

    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("renders settings button inside SettingsDialog", () => {
    render(<Toolbar entryCount={0} onAdd={() => {}} />);
    expect(screen.getByTestId("settings-dialog")).toBeInTheDocument();
  });
});
