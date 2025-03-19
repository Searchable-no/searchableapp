'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, MessageSquare, Calendar, FileText, ListTodo, Users } from 'lucide-react'

function TileSkeleton({ icon: Icon, title }: { icon: any, title: string }) {
  return (
    <Card className="h-full bg-gradient-to-br from-background to-muted/50 shadow-sm">
      <CardHeader className="py-1.5 px-2.5 border-b flex-none">
        <CardTitle className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <div className="p-1 rounded-md bg-primary/10">
              <Icon className="h-3 w-3 text-primary" />
            </div>
            <span>{title}</span>
          </div>
          <div className="h-4 w-16 animate-pulse rounded bg-muted"></div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 overflow-auto">
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-lg bg-muted/60"></div>
          <div className="h-12 animate-pulse rounded-lg bg-muted/60"></div>
          <div className="h-12 animate-pulse rounded-lg bg-muted/60"></div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 py-4 space-y-4 max-w-[1920px]">
        <div className="flex flex-col space-y-2 md:space-y-0 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="h-7 w-32 animate-pulse rounded bg-muted"></div>
            <div className="h-4 w-48 mt-1 animate-pulse rounded bg-muted/60"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-muted"></div>
            <div className="h-8 w-8 animate-pulse rounded-lg bg-muted"></div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="h-[280px] rounded-lg">
            <TileSkeleton icon={Mail} title="Recent Emails" />
          </div>
          <div className="h-[280px] rounded-lg">
            <TileSkeleton icon={MessageSquare} title="Teams Messages" />
          </div>
          <div className="h-[280px] rounded-lg">
            <TileSkeleton icon={Users} title="Teams Channels" />
          </div>
          <div className="h-[280px] rounded-lg">
            <TileSkeleton icon={Calendar} title="Calendar" />
          </div>
          <div className="h-[280px] rounded-lg">
            <TileSkeleton icon={FileText} title="Recent Files" />
          </div>
          <div className="h-[280px] rounded-lg">
            <TileSkeleton icon={ListTodo} title="Planner Tasks" />
          </div>
        </div>
      </div>
    </div>
  )
} 