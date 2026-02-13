import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import type { PageId } from "@/types"
import { SlidersHorizontal, FileBarChart, Scroll, HelpCircle, Users, Heart, Info, LayoutTemplate } from "lucide-react"
import IconSvg from "@/assets/icon.svg"

const NAV_ITEMS: { id: PageId; label: string; icon: typeof SlidersHorizontal }[] = [
  { id: "parameters", label: "Parameters", icon: SlidersHorizontal },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "changelog", label: "Changelog", icon: Scroll },
  { id: "community", label: "Community", icon: Users },
  { id: "support", label: "Support", icon: Heart },
  { id: "about", label: "About", icon: Info },
]

export function AppSidebar({
  activePage,
  onPageChange,
  connected,
}: {
  activePage: PageId
  onPageChange: (page: PageId) => void
  connected: boolean
}) {
  const { isMobile, setOpenMobile } = useSidebar()

  const handlePageChange = (page: PageId) => {
    onPageChange(page)
    // Close sidebar on mobile when a page is selected
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <img src={IconSvg} alt="App" className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold font-heading">Fretboard</span>
                <span className="truncate text-xs text-muted-foreground">Maker</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    tooltip={item.label}
                    isActive={activePage === item.id}
                    onClick={() => handlePageChange(item.id)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem className="flex justify-center group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              tooltip={connected ? "Connected" : "Connecting..."}
              className="pointer-events-none"
            >
              <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${connected ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-xs text-muted-foreground">
                {connected ? "Connected" : "Connecting..."}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Help & Support"
              isActive={activePage === "help"}
              onClick={() => handlePageChange("help")}
            >
              <HelpCircle />
              <span>Help</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
