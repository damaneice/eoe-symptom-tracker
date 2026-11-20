export type BiopsyLabel = "remission" | "responding" | "active";

/** Labels a biopsy by its peak eos/hpf. */
export function biopsyLabel(peakEosHpf: number): BiopsyLabel {
  if (peakEosHpf <= 6) return "remission";
  if (peakEosHpf < 15) return "responding";
  return "active";
}
