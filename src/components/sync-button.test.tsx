import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SyncButton } from "./sync-button";

describe("SyncButton", () => {
  it("shows 'Sync Now' when idle", () => {
    render(<SyncButton status="idle" disabled={false} onSync={() => {}} />);
    expect(screen.getByText("Sync Now")).toBeInTheDocument();
  });

  it("shows 'Syncing...' when running", () => {
    render(<SyncButton status="running" disabled={false} onSync={() => {}} />);
    expect(screen.getByText("Syncing...")).toBeInTheDocument();
  });

  it("button is disabled when running", () => {
    render(<SyncButton status="running" disabled={false} onSync={() => {}} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("button is disabled when disabled prop is true", () => {
    render(<SyncButton status="idle" disabled={true} onSync={() => {}} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("button is enabled when idle and not disabled", () => {
    render(<SyncButton status="idle" disabled={false} onSync={() => {}} />);
    const button = screen.getByRole("button");
    expect(button).not.toBeDisabled();
  });

  it("calls onSync when clicked", () => {
    const onSync = vi.fn();
    render(<SyncButton status="idle" disabled={false} onSync={onSync} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSync).toHaveBeenCalledOnce();
  });

  it("does not call onSync when disabled", () => {
    const onSync = vi.fn();
    render(<SyncButton status="idle" disabled={true} onSync={onSync} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSync).not.toHaveBeenCalled();
  });
});
