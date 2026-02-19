import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import { AlertCircle } from "lucide-react"

declare const __APP_VERSION__: string

export function BetaDisclaimer({
  onAccept,
}: {
  onAccept: (dontShowAgain: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const handleAccept = () => {
    onAccept(dontShowAgain)
  }

  const content = (
    <>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-yellow-50 dark:bg-yellow-950/30 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
        </div>
        <h2 className="text-base font-bold font-heading">Beta Version</h2>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        Parametric Guitar: Fretboard Maker is currently in beta. While I've tested extensively, you may encounter bugs or unexpected behavior. Always verify generated models before using them in production.
      </p>

      <p className="text-sm text-muted-foreground leading-relaxed">
        Models generated in this beta version may not be compatible with future updates. As the application evolves, design files created now may require modifications or may not open correctly in later versions.
      </p>

      <div className="flex items-center gap-2">
        <Checkbox
          id="dont-show-again"
          checked={dontShowAgain}
          onCheckedChange={(checked) => setDontShowAgain(checked === true)}
        />
        <label
          htmlFor="dont-show-again"
          className="text-xs text-muted-foreground cursor-pointer select-none"
        >
          Don't show this again
        </label>
      </div>

      <Button
        onClick={handleAccept}
        className="w-full"
      >
        I Understand
      </Button>
    </>
  )

  if (isMobile) {
    return (
      <Drawer open>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-sm">Important Notice</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-y-auto space-y-4">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-sm p-0 gap-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showClose={false}
      >
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-sm">Important Notice</DialogTitle>
        </DialogHeader>
        <div className="p-4 space-y-4">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  )
}
