import { describe, expect, it, vi } from "vitest";
import { withPendingIndicator } from "./pending";

describe("withPendingIndicator", () => {
  it("shows before work and dismisses after a successful result", async () => {
    const calls: string[] = [];
    const show = () => { calls.push("show"); return () => calls.push("dismiss"); };
    const result = await withPendingIndicator(show, true, async () => {
      calls.push("work");
      return "ok";
    });
    expect(calls).toEqual(["show", "work", "dismiss"]);
    expect(result).toBe("ok");
  });

  it("never shows when shouldShow is false", async () => {
    const show = vi.fn(() => vi.fn());
    const result = await withPendingIndicator(show, false, async () => "ok");
    expect(show).not.toHaveBeenCalled();
    expect(result).toBe("ok");
  });

  it("dismisses the indicator even when work() throws", async () => {
    let dismissed = false;
    const show = () => () => { dismissed = true; };
    await expect(
      withPendingIndicator(show, true, async () => { throw new Error("boom"); })
    ).rejects.toThrow("boom");
    expect(dismissed).toBe(true);
  });
});
