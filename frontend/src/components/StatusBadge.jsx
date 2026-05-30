import { Check, HelpCircle, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const MAP = {
  match: { variant: "success", icon: Check },
  uncertain: { variant: "warning", icon: HelpCircle },
  missing: { variant: "destructive", icon: X },
}

export default function StatusBadge({ status, labels }) {
  const key = status === "match" || status === "uncertain" ? status : "missing"
  const { variant, icon: Icon } = MAP[key]
  const defaults = { match: "Match", uncertain: "Uncertain", missing: "Missing" }
  const label = labels?.[key] ?? defaults[key]
  return (
    <Badge variant={variant}>
      <Icon />
      {label}
    </Badge>
  )
}
