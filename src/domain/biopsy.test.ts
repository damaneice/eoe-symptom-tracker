import { describe, expect, it } from "vitest";
import { biopsyLabel } from "./biopsy";

describe("biopsyLabel", () => {
  it("is remission at 6 eos/hpf or fewer", () => {
    expect(biopsyLabel(0)).toBe("remission");
    expect(biopsyLabel(6)).toBe("remission");
  });

  it("is responding from 7 up to 14 eos/hpf", () => {
    expect(biopsyLabel(7)).toBe("responding");
    expect(biopsyLabel(14)).toBe("responding");
  });

  it("is active at 15 eos/hpf or more", () => {
    expect(biopsyLabel(15)).toBe("active");
    expect(biopsyLabel(80)).toBe("active");
  });
});
