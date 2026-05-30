import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function CopyButton({ text, isCopied, onCopy }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      onCopy()
    } catch (e) {
      console.error("Copy failed", e)
    }
  }
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={copy}
      title={`Copy: ${text}`}
      className={cn(
        "h-7 px-2.5 text-xs",
        isCopied && "border-[oklch(0.7_0.16_150/0.4)] text-[oklch(0.8_0.16_150)]"
      )}
    >
      {isCopied ? <Check /> : <Copy />}
      {isCopied ? "Copied" : "Copy"}
    </Button>
  )
}
