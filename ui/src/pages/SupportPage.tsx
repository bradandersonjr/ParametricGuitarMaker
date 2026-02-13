import { Button } from "@/components/ui/button"
import { openUrl } from "@/lib/fusion-bridge"
import { Heart, Coffee, Github } from "lucide-react"

export function SupportPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-sm font-bold tracking-tight font-heading">Support</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Help keep this project alive and growing.
        </p>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <div className="flex flex-col items-center gap-3 text-center max-w-xs">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
            <Heart className="w-6 h-6 text-red-500" />
          </div>

          <h2 className="text-sm font-bold font-heading">Support This Project</h2>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Parametric Guitar: Fretboard Maker is a free, open-source tool built with passion.
            If it's helped you design custom fretboards, consider buying me a coffee
            to keep development going.
          </p>

          <Button
            className="mt-2 gap-2"
            size="sm"
            onClick={() => openUrl("https://ko-fi.com/bradandersonjr")}
          >
            <Coffee size={14} />
            Support on Ko-fi
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => openUrl("https://github.com/bradandersonjr/ParametricGuitarFretboardMaker")}
          >
            <Github size={14} />
            Star on GitHub
          </Button>
        </div>

        <div className="text-center max-w-xs">
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            You can also contribute by reporting bugs, requesting features,
            or submitting pull requests on GitHub.
          </p>
        </div>
      </div>
    </div>
  )
}
