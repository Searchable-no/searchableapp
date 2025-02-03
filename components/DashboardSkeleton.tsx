'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, MessageSquare, Calendar, FileText, ListTodo } from 'lucide-react'

function TileSkeleton({ icon: Icon, title }: { icon: any, title: string }) {
  return (
    <Card className="h-full">
      <CardHeader className="py-2 px-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <Icon className="h-3 w-3" />
            {title}
          </div>
          <div className="h-6 w-20 animate-pulse rounded bg-muted"></div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 overflow-auto max-h-[250px]">
        <div className="space-y-2">
          <div className="h-[72px] animate-pulse rounded bg-muted"></div>
          <div className="h-[72px] animate-pulse rounded bg-muted"></div>
          <div className="h-[72px] animate-pulse rounded bg-muted"></div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="container mx-auto p-2">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="h-8 w-32 animate-pulse rounded bg-muted"></div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="col-span-1 min-h-[200px] max-h-[300px]">
          <TileSkeleton icon={Mail} title="Recent Emails" />
        </div>
        <div className="col-span-1 min-h-[200px] max-h-[300px]">
          <TileSkeleton icon={MessageSquare} title="Teams Messages" />
        </div>
        <div className="col-span-1 min-h-[200px] max-h-[300px]">
          <TileSkeleton icon={MessageSquare} title="Teams Channels" />
        </div>
        <div className="col-span-1 min-h-[200px] max-h-[300px]">
          <TileSkeleton icon={Calendar} title="Calendar" />
        </div>
        <div className="col-span-1 min-h-[200px] max-h-[300px]">
          <TileSkeleton icon={FileText} title="Recent Files" />
        </div>
        <div className="col-span-1 min-h-[200px] max-h-[300px]">
          <TileSkeleton icon={ListTodo} title="Planner Tasks" />
        </div>
      </div>
    </div>
  )
} 