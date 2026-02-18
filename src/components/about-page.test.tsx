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

import { AboutPage } from "./about-page";

describe("AboutPage", () => {
  it("renders About title", () => {
    render(<AboutPage onBack={() => {}} />);
    expect(screen.getByText("About")).toBeInTheDocument();
  });

  it("renders logo image with correct src", () => {
    render(<AboutPage onBack={() => {}} />);
    const logo = screen.getByAltText("Shrike");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/logo-128.png");
  });

  it("renders app name and version", () => {
    render(<AboutPage onBack={() => {}} />);
    expect(screen.getByText("Shrike")).toBeInTheDocument();
    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
  });

  it("renders GitHub link with correct href", () => {
    render(<AboutPage onBack={() => {}} />);
    const link = screen.getByLabelText("GitHub");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://github.com/nocoo/shrike");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("calls onBack when back button is clicked", () => {
    const onBack = vi.fn();
    render(<AboutPage onBack={onBack} />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("has data-tauri-drag-region for window dragging", () => {
    const { container } = render(<AboutPage onBack={() => {}} />);
    const dragRegions = container.querySelectorAll("[data-tauri-drag-region]");
    // header + traffic light zone + content row = 3 drag regions
    expect(dragRegions.length).toBe(3);
  });

  it("prevents context menu", () => {
    const { container } = render(<AboutPage onBack={() => {}} />);
    const mainDiv = container.firstElementChild as HTMLElement;
    const event = new MouseEvent("contextmenu", { bubbles: true });
    const preventDefault = vi.spyOn(event, "preventDefault");
    mainDiv.dispatchEvent(event);
    expect(preventDefault).toHaveBeenCalled();
  });
});
