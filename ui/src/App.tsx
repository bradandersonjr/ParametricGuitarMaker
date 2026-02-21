import { useState, useCallback, useEffect } from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/AppSidebar"
import { AnnouncementBar } from "@/components/AnnouncementBar"
import { VersionHeader } from "@/components/VersionHeader"
import { UnitIndicator } from "@/components/UnitIndicator"
import { BetaDisclaimer } from "@/components/BetaDisclaimer"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { useModelPayload } from "@/hooks/useModelPayload"
import { onPythonMessage } from "@/lib/fusion-bridge"
import { useVersionCheck } from "@/hooks/useVersionCheck"
import { ParametersPage } from "@/pages/ParametersPage"
import { ReportsPage } from "@/pages/ReportsPage"
import { ChangelogPage } from "@/pages/ChangelogPage"
import { SharePage } from "@/pages/SharePage"
import { HelpPage } from "@/pages/HelpPage"
import { CommunityPage } from "@/pages/CommunityPage"
import { SupportPage } from "@/pages/SupportPage"
import { AboutPage } from "@/pages/AboutPage"
import { TemplatesPage } from "@/pages/TemplatesPage"
import type { PageId } from "@/types"

declare const __APP_VERSION__: string
const APP_VERSION = __APP_VERSION__
const BETA_DISCLAIMER_SESSION_KEY = "pgfm_beta_disclaimer_dismissed_session"

function App() {
  const [activePage, setActivePage] = useState<PageId>("parameters")
  const [importSuccess, setImportSuccess] = useState(false)
  const [dismissedThisSession, setDismissedThisSession] = useState(false)
  const { payload, connected, templateList } = useModelPayload()
  const versionInfo = useVersionCheck(APP_VERSION)

  // Sync dismissal state from sessionStorage (session-only behavior).
  useEffect(() => {
    const syncFromSession = () => {
      const hiddenForSession = sessionStorage.getItem(BETA_DISCLAIMER_SESSION_KEY) === "1"
      setDismissedThisSession(hiddenForSession)
    }

    syncFromSession()
    return onPythonMessage('PALETTE_RESHOWN', () => {
      syncFromSession()
    })
  }, [])

  // Show disclaimer unless user opted to hide it for this Fusion session.
  const showBetaDisclaimer = !dismissedThisSession

  const handleDisclaimerAccept = useCallback((dontShowAgain: boolean) => {
    if (dontShowAgain) {
      sessionStorage.setItem(BETA_DISCLAIMER_SESSION_KEY, "1")
    } else {
      sessionStorage.removeItem(BETA_DISCLAIMER_SESSION_KEY)
    }
    setDismissedThisSession(true)
  }, [])

  return (
    <ErrorBoundary>
      <SidebarProvider defaultOpen={false}>
        {showBetaDisclaimer && (
          <BetaDisclaimer onAccept={handleDisclaimerAccept} />
        )}
        <div className="flex h-screen w-full bg-background text-foreground">
          <AppSidebar
            activePage={activePage}
            onPageChange={setActivePage}
            connected={connected}
            hasFingerprint={payload?.hasFingerprint ?? false}
          />

          <SidebarInset className="flex flex-col min-w-0">
            {/* Sidebar toggle + app name + version */}
            <div className="flex items-center justify-between px-2 pt-1 shrink-0 gap-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-0.5" />
                <UnitIndicator unit={payload?.documentUnit} />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-muted-foreground font-heading md:text-sm text-xs whitespace-nowrap">Parametric Guitar: Fretboard Maker</span>
                <VersionHeader version={versionInfo.current} isOutdated={versionInfo.isOutdated} />
              </div>
            </div>

            <AnnouncementBar />

            {/* Pages - ParametersPage is always mounted (hidden) to preserve edit state */}
            <div className={activePage === "parameters" ? "flex flex-col flex-1 min-h-0" : "hidden"}>
              <ParametersPage
                payload={payload}
                showImportSuccess={importSuccess}
                onDismissImportSuccess={() => setImportSuccess(false)}
              />
            </div>
            {activePage === "templates" && (
              <TemplatesPage payload={payload} templateList={templateList} onTemplateLoaded={() => setActivePage("parameters")} />
            )}
            {activePage === "reports" && <ReportsPage payload={payload} />}
            {activePage === "changelog" && <ChangelogPage />}
            {activePage === "share" && (
              <SharePage
                payload={payload}
                version={APP_VERSION}
                onImportLoaded={() => {
                  setImportSuccess(true)
                  setTimeout(() => setActivePage("parameters"), 50)
                }}
              />
            )}
            {activePage === "help" && <HelpPage />}
            {activePage === "community" && <CommunityPage />}
            {activePage === "support" && <SupportPage />}
            {activePage === "about" && <AboutPage version={versionInfo.current} />}
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ErrorBoundary>
  )
}

export default App
