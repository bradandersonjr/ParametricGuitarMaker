import { ScrollArea } from "@/components/ui/scroll-area"
import { openUrl } from "@/lib/fusion-bridge"
import { IconBrandYoutube, IconBrandFacebook, IconBrandDiscord, IconBrowser } from "@tabler/icons-react"

export function CommunityPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="px-4 py-3 border-b border-border shrink-0">
        <h1 className="text-sm font-bold tracking-tight font-heading">Community</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Connect with other users and stay updated.
        </p>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* YouTube */}
          <button
            onClick={() => openUrl("https://www.youtube.com/@bradandersonjr")}
            className="w-full p-4 border border-border rounded-lg hover:bg-muted transition-colors text-left group"
          >
            <div className="flex items-start gap-3">
              <div className="pt-1">
                <IconBrandYoutube className="size-5 text-red-500 group-hover:text-red-600" stroke={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold font-heading">YouTube Channel</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Watch tutorials, demos, and updates about parametric guitar design.
                </p>
                <p className="text-xs text-primary mt-2">@bradandersonjr →</p>
              </div>
            </div>
          </button>

          {/* Website */}
          <button
            onClick={() => openUrl("https://parametricguitar.com")}
            className="w-full p-4 border border-border rounded-lg hover:bg-muted transition-colors text-left group"
          >
            <div className="flex items-start gap-3">
              <div className="pt-1">
                <IconBrowser className="size-5 text-amber-900 group-hover:text-amber-950" stroke={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold font-heading">Website</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Official website with documentation, resources, and project information.
                </p>
                <p className="text-xs text-primary mt-2">parametricguitar.com →</p>
              </div>
            </div>
          </button>

          {/* Discord */}
          <button
            onClick={() => openUrl("https://discord.gg/KQ8NvAFksZ")}
            className="w-full p-4 border border-border rounded-lg hover:bg-muted transition-colors text-left group"
          >
            <div className="flex items-start gap-3">
              <div className="pt-1">
                <IconBrandDiscord className="size-5 text-indigo-500 group-hover:text-indigo-600" stroke={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold font-heading">Discord Server</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Join our Discord community to chat with other users, ask questions, and share your designs.
                </p>
                <p className="text-xs text-primary mt-2">The Parametric Guitar Project →</p>
              </div>
            </div>
          </button>

          {/* Facebook Group */}
          <button
            onClick={() => openUrl("https://www.facebook.com/groups/Fusion360Luthiers/")}
            className="w-full p-4 border border-border rounded-lg hover:bg-muted transition-colors text-left group"
          >
            <div className="flex items-start gap-3">
              <div className="pt-1">
                <IconBrandFacebook className="size-5 text-blue-600 group-hover:text-blue-700" stroke={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold font-heading">Facebook Group</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Connect with luthiers using Autodesk Fusion in the Fusion 360 Luthiers community.
                </p>
                <p className="text-xs text-primary mt-2">Fusion 360 Luthiers →</p>
              </div>
            </div>
          </button>

          {/* Divider */}
          <div className="border-t border-border/50 my-4" />

          {/* Community Guidelines */}
          <section>
            <h2 className="text-sm font-semibold font-heading mb-2">Community Guidelines</h2>
            <div className="space-y-2 text-xs text-muted-foreground">
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Be respectful and constructive in all discussions</li>
                <li>Share your designs and get feedback from the community</li>
                <li>Help others by answering questions and sharing knowledge</li>
                <li>Report bugs and suggest improvements on GitHub</li>
                <li>Have fun and enjoy the luthier community!</li>
              </ul>
            </div>
          </section>

          {/* Ways to Contribute */}
          <section>
            <h2 className="text-sm font-semibold font-heading mb-2">Ways to Contribute</h2>
            <div className="space-y-2 text-xs text-muted-foreground">
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Share your guitar designs with the community</li>
                <li>Provide feedback and suggestions for improvements</li>
                <li>Report bugs and issues on GitHub</li>
                <li>Help other users in the Discord or Facebook group</li>
                <li>Create tutorials or documentation</li>
              </ul>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}
