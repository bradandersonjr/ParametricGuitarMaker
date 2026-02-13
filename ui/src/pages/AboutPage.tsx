import { Button } from "@/components/ui/button"
import { openUrl } from "@/lib/fusion-bridge"
import { Github, ExternalLink } from "lucide-react"
import IconSvg from "@/assets/icon.svg"

export function AboutPage({ version }: { version: string }) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-sm font-bold tracking-tight font-heading">About</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          About this project and its creator.
        </p>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <div className="flex flex-col items-center gap-3 text-center max-w-xs">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <img src={IconSvg} alt="App" className="w-6 h-6 [&_path]:fill-current text-primary" />
          </div>

          <div>
            <h2 className="text-sm font-bold font-heading">Parametric Guitar: Fretboard Maker</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Version {version}</p>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            A specialized fretboard design tool for Autodesk Fusion. Design custom
            fretboards with precise control over scale length, fret positions, string
            spacing, and more — with real-time 3D visualization.
          </p>

          <div className="border-t border-border/50 w-full my-1" />

          <div>
            <p className="text-xs font-semibold font-heading">Built by Brad Anderson Jr.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Luthier, engineer, and open-source enthusiast.
            </p>
          </div>

          <div className="flex gap-2 mt-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => openUrl("https://github.com/bradandersonjr/ParametricGuitarFretboardMaker")}
            >
              <Github size={14} />
              GitHub
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => openUrl("https://github.com/bradandersonjr/ParametricGuitarFretboardMaker/releases")}
            >
              <ExternalLink size={14} />
              Releases
            </Button>
          </div>
        </div>

        <div className="text-center max-w-xs">
          <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
            React + TypeScript + Tailwind CSS + shadcn/ui
            <br />
            Powered by Autodesk Fusion API
          </p>
        </div>
      </div>
    </div>
  )
}
