import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  showSearch?: boolean
}

// Read accent color once from CSS variables so inline styles match the theme
function getAccentColors() {
  const s = getComputedStyle(document.documentElement)
  return {
    bg: `hsl(${s.getPropertyValue("--accent").trim()})`,
    fg: `hsl(${s.getPropertyValue("--accent-foreground").trim()})`,
  }
}

function ComboboxSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  disabled = false,
  className,
  showSearch = true,
}: ComboboxSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const listRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const activeRef = React.useRef<HTMLElement | null>(null)
  const colorsRef = React.useRef<{ bg: string; fg: string } | null>(null)

  const selectedLabel = options.find((opt) => opt.value === value)?.label

  const filtered = search
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
      )
    : options

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setSearch("")
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (listRef.current) {
      listRef.current.scrollBy({ top: e.deltaY })
    }
  }

  // Direct DOM highlight — no React state, no CSS :hover, instant feedback
  function highlightItem(el: HTMLElement) {
    if (!colorsRef.current) colorsRef.current = getAccentColors()
    if (activeRef.current && activeRef.current !== el) {
      activeRef.current.style.backgroundColor = ""
      activeRef.current.style.color = ""
    }
    el.style.backgroundColor = colorsRef.current.bg
    el.style.color = colorsRef.current.fg
    activeRef.current = el
  }

  function clearHighlight() {
    if (activeRef.current) {
      activeRef.current.style.backgroundColor = ""
      activeRef.current.style.color = ""
      activeRef.current = null
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn(!selectedLabel && "text-muted-foreground")}>
            {selectedLabel ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          colorsRef.current = null
          if (showSearch) inputRef.current?.focus()
        }}
      >
        {showSearch && (
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
        <div
          ref={listRef}
          onWheel={handleWheel}
          onPointerLeave={clearHighlight}
          className="max-h-[300px] overflow-y-auto overflow-x-hidden p-1"
        >
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt.value}
                onPointerEnter={(e) => highlightItem(e.currentTarget)}
                onPointerMove={(e) => highlightItem(e.currentTarget)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onValueChange(opt.value)
                  handleOpenChange(false)
                }}
                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1 text-xs outline-none"
              >
                <Check
                  className={cn(
                    "mr-2 h-3 w-3 shrink-0",
                    value === opt.value ? "opacity-100" : "opacity-0"
                  )}
                />
                {opt.label}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { ComboboxSelect }
