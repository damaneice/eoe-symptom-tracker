import type { EventType, SideEffect, Site } from "../domain/types";
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

export const EVENT_LABELS: Record<EventType, string> = {
  diet: "Diet change",
  medication: "Medication change",
  illness: "Illness",
  other: "Other",
};

/** Tailwind classes per event type, so the chart and lists use the same color. */
export const EVENT_COLORS: Record<EventType, { text: string; fill: string; pill: string }> = {
  diet: {
    text: "text-event-diet",
    fill: "fill-event-diet",
    pill: "bg-event-diet/15 text-event-diet",
  },
  medication: {
    text: "text-event-medication",
    fill: "fill-event-medication",
    pill: "bg-event-medication/15 text-event-medication",
  },
  illness: {
    text: "text-event-illness",
    fill: "fill-event-illness",
    pill: "bg-event-illness/15 text-event-illness",
  },
  other: {
    text: "text-event-other",
    fill: "fill-event-other",
    pill: "bg-event-other/15 text-event-other",
  },
};

export const BIOPSY_LABELS: Record<
  BiopsyLabel,
  { text: string; tone: "good" | "neutral" | "bad" }
> = {
  remission: { text: "Remission range", tone: "good" },
  responding: { text: "Responding", tone: "neutral" },
  active: { text: "Active", tone: "bad" },
};
