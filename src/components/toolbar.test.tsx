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

import { Toolbar } from "./toolbar";

describe("Toolbar", () => {
  const defaultProps = {
    entryCount: 0,
    onAdd: () => {},
    onWizard: () => {},
    onSettings: () => {},
    onAbout: () => {},
  };

  it("renders app title", () => {
    render(<Toolbar {...defaultProps} />);
    expect(screen.getByText("Shrike")).toBeInTheDocument();
  });

  it("renders logo image", () => {
    render(<Toolbar {...defaultProps} />);
    const logo = screen.getByAltText("Shrike");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/logo-64.png");
  });

  it("does not show count when entryCount is 0", () => {
    render(<Toolbar {...defaultProps} />);
    expect(screen.queryByText(/item/)).not.toBeInTheDocument();
  });

  it("shows singular count for 1 item", () => {
    render(<Toolbar {...defaultProps} entryCount={1} />);
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });

  it("shows plural count for multiple items", () => {
    render(<Toolbar {...defaultProps} entryCount={5} />);
    expect(screen.getByText("5 items")).toBeInTheDocument();
  });

  it("calls onAdd when + button is clicked", () => {
    const onAdd = vi.fn();
    render(<Toolbar {...defaultProps} onAdd={onAdd} />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);

    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("calls onWizard when wizard button is clicked", () => {
    const onWizard = vi.fn();
    render(<Toolbar {...defaultProps} onWizard={onWizard} />);

    const buttons = screen.getAllByRole("button");
    // Wizard button is the second button (Plus=0, Wand2=1, Settings=2, Info=3)
    fireEvent.click(buttons[1]);

    expect(onWizard).toHaveBeenCalledOnce();
  });

  it("calls onSettings when settings button is clicked", () => {
    const onSettings = vi.fn();
    render(<Toolbar {...defaultProps} onSettings={onSettings} />);

    const buttons = screen.getAllByRole("button");
    // Settings button is the third button (Plus=0, Wand2=1, Settings=2, Info=3)
    fireEvent.click(buttons[2]);

    expect(onSettings).toHaveBeenCalledOnce();
  });

  it("calls onAbout when info button is clicked", () => {
    const onAbout = vi.fn();
    render(<Toolbar {...defaultProps} onAbout={onAbout} />);

    const buttons = screen.getAllByRole("button");
    // Info button is the fourth button (Plus=0, Wand2=1, Settings=2, Info=3)
    fireEvent.click(buttons[3]);

    expect(onAbout).toHaveBeenCalledOnce();
  });

  it("has data-tauri-drag-region for window dragging", () => {
    const { container } = render(<Toolbar {...defaultProps} />);
    const dragRegions = container.querySelectorAll("[data-tauri-drag-region]");
    // header + traffic light zone + content row = 3 drag regions
    expect(dragRegions.length).toBe(3);
  });

  it("uses fixed positioning for sticky header", () => {
    const { container } = render(<Toolbar {...defaultProps} />);
    const header = container.querySelector("header");
    expect(header).toBeInTheDocument();
    expect(header?.className).toContain("fixed");
    expect(header?.className).toContain("top-0");
  });

  it("has traffic light zone as first child", () => {
    const { container } = render(<Toolbar {...defaultProps} />);
    const header = container.querySelector("header");
    const trafficLightZone = header?.firstElementChild as HTMLElement;
    expect(trafficLightZone.className).toContain("h-[38px]");
  });
});
