import { cn } from "@/lib/utils"

const TONES = {
  missing: "data-[active=true]:border-[oklch(0.62_0.2_25/0.6)] data-[active=true]:text-[oklch(0.75_0.19_25)]",
  uncertain: "data-[active=true]:border-[oklch(0.78_0.13_85/0.6)] data-[active=true]:text-[oklch(0.85_0.13_85)]",
  match: "data-[active=true]:border-[oklch(0.7_0.16_150/0.6)] data-[active=true]:text-[oklch(0.8_0.16_150)]",
  all: "data-[active=true]:border-primary/60 data-[active=true]:text-foreground",
}

export default function StatChip({ tone = "all", active, count, label, onClick }) {
  return (
    <button
      type="button"
      data-active={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-baseline gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors cursor-pointer",
        "hover:bg-accent/40 data-[active=true]:bg-accent/60",
        TONES[tone]
      )}
    >
      <span className="text-sm font-semibold tabular-nums text-foreground">{count}</span>
      <span>{label}</span>
    </button>
  )
}
