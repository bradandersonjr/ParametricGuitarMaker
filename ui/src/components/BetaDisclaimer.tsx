import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

declare const __APP_VERSION__: string

export function BetaDisclaimer({
  onAccept,
}: {
  onAccept: () => void
}) {

  const handleAccept = () => {
    localStorage.setItem("beta-disclaimer-version", __APP_VERSION__)
    onAccept()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-50 dark:bg-yellow-950/30 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
          </div>
          <h2 className="text-base font-bold font-heading">Beta Version</h2>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Parametric Guitar: Fretboard Maker is currently in beta. While we've tested extensively, you may encounter bugs or unexpected behavior. Always verify generated models before using them in production.
        </p>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Models generated in this beta version may not be compatible with future updates. As the application evolves, design files created now may require modifications or may not open correctly in later versions.
        </p>

        <Button
          onClick={handleAccept}
          className="w-full"
        >
          I Understand
        </Button>
      </div>
    </div>
  )
}
