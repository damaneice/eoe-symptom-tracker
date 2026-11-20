import type { SideEffect, Site } from "../domain/types";
import type { BiopsyLabel } from "../domain/biopsy";

export const SITE_LABELS: Record<Site, string> = {
  "left-thigh": "Left thigh",
  "right-thigh": "Right thigh",
  "left-abdomen": "Left abdomen",
  "right-abdomen": "Right abdomen",
  "left-upper-arm": "Left upper arm",
  "right-upper-arm": "Right upper arm",
};

export const SIDE_EFFECT_LABELS: Record<SideEffect, string> = {
  none: "None",
  "injection-site-reaction": "Injection-site redness or swelling",
  "eye-redness": "Eye redness or irritation",
  "cold-sore": "Cold sore",
  "joint-pain": "Joint pain",
  other: "Other (see note)",
};

export const BIOPSY_LABELS: Record<
  BiopsyLabel,
  { text: string; tone: "good" | "neutral" | "bad" }
> = {
  remission: { text: "Remission range", tone: "good" },
  responding: { text: "Responding", tone: "neutral" },
  active: { text: "Active", tone: "bad" },
};
