"use client"

import { FileIcon, Search } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SidebarInset } from "@/components/ui/sidebar"

export default function SearchPage() {
  return (
    <SidebarInset className="flex-1">
      <div className="flex flex-col gap-6 p-6">
        <h1 className="text-3xl font-bold tracking-tight text-[#000000]">Search</h1>
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8d97] transition-colors group-focus-within:text-[#7faff2]" />
            <input
              placeholder="Type a command or search..."
              className="w-full rounded-lg border border-[#ecf1f8] bg-[#ffffff] px-10 py-2 text-sm shadow-sm transition-all placeholder:text-[#8b8d97] hover:border-[#bec0ca] focus:border-[#7faff2] focus:outline-none focus:ring-2 focus:ring-[#7faff2]/20"
            />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-[130px] bg-[#ffffff] shadow-sm">
              <SelectValue placeholder="Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="docs">Documents</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="recent">
            <SelectTrigger className="w-[130px] bg-[#ffffff] shadow-sm">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="last-week">Last Week</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-4 pt-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="group relative flex items-start gap-4 rounded-lg border border-[#ecf1f8] bg-[#ffffff] p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ecf1f8] text-[#7faff2] transition-colors group-hover:bg-[#7faff2] group-hover:text-[#ffffff]">
                <FileIcon className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold text-[#000000] group-hover:text-[#7faff2]">
                  2025-01 - Searchable - Business Case
                </h3>
                <p className="text-sm text-[#8b8d97]">
                  Last modified Jan 1, 2025, 6:04 pm
                </p>
                {i === 1 && (
                  <p className="mt-2 text-sm text-[#45464e] leading-relaxed">
                    In an era where data is often referred to as the "new oil,"
                    businesses grapple with an abundance of information scattered
                    across multiple systems, platforms, and formats. Searchable
                    emerges as a groundbreaking solution to address this
                    challenge, enabling organizations to unlock the full potential
                    of their data by making it easily accessible,
                    comprehensible, and actionable.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SidebarInset>
  )
}

