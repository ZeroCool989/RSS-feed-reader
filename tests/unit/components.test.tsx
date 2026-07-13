// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Toast from "@/components/Toast";
import Favicon from "@/components/Favicon";
import ShortcutsHelp from "@/components/ShortcutsHelp";
import { useStore } from "@/lib/store";

beforeEach(() => {
  cleanup();
  localStorage.clear();
  useStore.getState().resetAll();
  useStore.setState({ toast: null, shortcutsOpen: false });
});

describe("<Toast />", () => {
  it("renders nothing without a toast, announces one politely when set", () => {
    const { container, rerender } = render(<Toast />);
    expect(container.firstChild).toBeNull();

    useStore.getState().showToast("Subscribed to CSS-Tricks");
    rerender(<Toast />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Subscribed to CSS-Tricks");
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("runs the undo callback and dismisses", () => {
    let undone = false;
    useStore.getState().showToast("Marked 5 items as read", () => {
      undone = true;
    });
    render(<Toast />);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(undone).toBe(true);
    expect(useStore.getState().toast).toBeNull();
  });
});

describe("<Favicon />", () => {
  it("renders the image when a src is given", () => {
    render(<Favicon src="https://example.com/icon.png" alt="Example" />);
    const img = screen.getByRole("img", { name: "Example" });
    expect(img.getAttribute("src")).toBe("https://example.com/icon.png");
  });

  it("falls back to the RSS glyph when the image fails to load", () => {
    render(<Favicon src="https://example.com/broken.png" alt="Broken" />);
    fireEvent.error(screen.getByRole("img", { name: "Broken" }));
    expect(screen.queryByRole("img")).toBeNull(); // replaced by aria-hidden glyph
  });

  it("renders the fallback glyph directly for a null src", () => {
    const { container } = render(<Favicon src={null} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });
});

describe("<ShortcutsHelp />", () => {
  it("opens as a labelled dialog and closes via its close button", () => {
    useStore.setState({ shortcutsOpen: true });
    render(<ShortcutsHelp />);
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close shortcuts" }));
    expect(useStore.getState().shortcutsOpen).toBe(false);
  });
});
