import { useState, useEffect } from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { AnnouncementBar } from "@/components/AnnouncementBar"
import { VersionHeader } from "@/components/VersionHeader"
import { BetaDisclaimer } from "@/components/BetaDisclaimer"
import { useModelPayload } from "@/hooks/useModelPayload"
import { useVersionCheck } from "@/hooks/useVersionCheck"
import { ParametersPage } from "@/pages/ParametersPage"
import { ReportsPage } from "@/pages/ReportsPage"
import { ChangelogPage } from "@/pages/ChangelogPage"
import { HelpPage } from "@/pages/HelpPage"
import { CommunityPage } from "@/pages/CommunityPage"
import { SupportPage } from "@/pages/SupportPage"
import { AboutPage } from "@/pages/AboutPage"
import { TemplatesPage } from "@/pages/TemplatesPage"
import type { PageId } from "@/types"

declare const __APP_VERSION__: string
const APP_VERSION = __APP_VERSION__

function App() {
  const [activePage, setActivePage] = useState<PageId>("parameters")
  const [showBetaDisclaimer, setShowBetaDisclaimer] = useState(false)
  const { payload, connected, templateList } = useModelPayload()
  const versionInfo = useVersionCheck(APP_VERSION)

  useEffect(() => {
    // Always show beta disclaimer when palette opens
    setShowBetaDisclaimer(true)
  }, [])


  return (
    <SidebarProvider defaultOpen={false}>
      {showBetaDisclaimer && (
        <BetaDisclaimer onAccept={() => setShowBetaDisclaimer(false)} />
      )}
      <div className="flex h-screen w-full bg-background text-foreground">
        <AppSidebar
          activePage={activePage}
          onPageChange={setActivePage}
          connected={connected}
        />

        <SidebarInset className="flex flex-col min-w-0">
          {/* Sidebar toggle + app name + version */}
          <div className="flex items-center justify-between px-2 pt-1 shrink-0">
            <SidebarTrigger className="-ml-0.5" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground font-heading">Parametric Guitar: Fretboard Maker</span>
              <VersionHeader version={versionInfo.current} isOutdated={versionInfo.isOutdated} />
            </div>
          </div>

          <AnnouncementBar />

          {/* Pages — ParametersPage is always mounted (hidden) to preserve edit state */}
          <div className={activePage === "parameters" ? "flex flex-col flex-1 min-h-0" : "hidden"}>
            <ParametersPage payload={payload} />
          </div>
          {activePage === "templates" && (
            <TemplatesPage payload={payload} templateList={templateList} onTemplateLoaded={() => setActivePage("parameters")} />
          )}
          {activePage === "reports" && <ReportsPage payload={payload} />}
          {activePage === "changelog" && <ChangelogPage />}
          {activePage === "help" && <HelpPage />}
          {activePage === "community" && <CommunityPage />}
          {activePage === "support" && <SupportPage />}
          {activePage === "about" && <AboutPage version={versionInfo.current} />}
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

export default App
