"use client";

import { FileText, MessageSquare, Users, Mail, Calendar } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const teamMessages = [
  {
    id: 1,
    sender: "Alice Cooper",
    team: "Design Team",
    message: "New mockups are ready for review",
    time: "10:30 AM",
  },
  {
    id: 2,
    sender: "Bob Smith",
    team: "Dev Team",
    message: "API endpoints have been updated",
    time: "11:45 AM",
  },
  {
    id: 3,
    sender: "Charlie Brown",
    team: "Marketing",
    message: "Q4 strategy draft is completed",
    time: "1:15 PM",
  },
];

const chatMessages = [
  {
    id: 1,
    sender: "David Lee",
    message: "Can you check the latest commit?",
    time: "2:30 PM",
  },
  {
    id: 2,
    sender: "Emma Watson",
    message: "Meeting rescheduled to 4 PM",
    time: "3:00 PM",
  },
  {
    id: 3,
    sender: "Frank Castle",
    message: "New feature request from client",
    time: "3:45 PM",
  },
];

const emails = [
  {
    id: 1,
    sender: "John Doe",
    subject: "Project Update",
    preview: "Here's the latest update on...",
    time: "9:00 AM",
  },
  {
    id: 2,
    sender: "Jane Smith",
    subject: "Meeting Minutes",
    preview: "Attached are the minutes from...",
    time: "11:30 AM",
  },
  {
    id: 3,
    sender: "Mike Johnson",
    subject: "Urgent: Client Feedback",
    preview: "The client has provided feedback...",
    time: "2:15 PM",
  },
];

const files = [
  {
    id: 1,
    name: "Project Requirements.pdf",
    size: "2.4 MB",
    time: "2 hours ago",
  },
  {
    id: 2,
    name: "Q3 Financial Report.xlsx",
    size: "1.8 MB",
    time: "Yesterday",
  },
  { id: 3, name: "Marketing Strategy.pptx", size: "5.2 MB", time: "Jul 10" },
];

const calendarEvents = [
  { id: 1, title: "Team Sync", time: "2:00 PM - 3:00 PM", date: "Today" },
  {
    id: 2,
    title: "Client Presentation",
    time: "10:00 AM - 11:30 AM",
    date: "Tomorrow",
  },
  {
    id: 3,
    title: "Project Kickoff",
    time: "9:00 AM - 10:00 AM",
    date: "Jul 15",
  },
];

export default function DashboardPage() {
  return (
    <div className="flex-1 p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#130f26]">Welcome back</h1>
        <p className="text-[#8b8d97]">
          Here&apos;s what&apos;s happening across your workspace
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <section className="bg-white rounded-lg p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <h2 className="font-semibold text-gray-900">Team Messages</h2>
          </div>
          <div className="space-y-4">
            {teamMessages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-3 group">
                <Avatar className="h-9 w-9 ring-2 ring-blue-50">
                  <AvatarFallback className="bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 font-medium">
                    {msg.sender[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                      {msg.sender}
                    </span>
                    <span className="text-gray-500"> in {msg.team}</span>
                  </p>
                  <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                    {msg.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{msg.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-lg p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-purple-50 rounded-lg">
              <MessageSquare className="h-5 w-5 text-purple-500" />
            </div>
            <h2 className="font-semibold text-gray-900">Chat Messages</h2>
          </div>
          <div className="space-y-4">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-3 group">
                <Avatar className="h-9 w-9 ring-2 ring-purple-50">
                  <AvatarFallback className="bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600 font-medium">
                    {msg.sender[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-purple-600 transition-colors">
                    {msg.sender}
                  </p>
                  <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                    {msg.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{msg.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-lg p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-green-50 rounded-lg">
              <Mail className="h-5 w-5 text-green-500" />
            </div>
            <h2 className="font-semibold text-gray-900">Recent Emails</h2>
          </div>
          <div className="space-y-4">
            {emails.map((email) => (
              <div key={email.id} className="flex items-start gap-3 group">
                <Avatar className="h-9 w-9 ring-2 ring-green-50">
                  <AvatarFallback className="bg-gradient-to-br from-green-50 to-green-100 text-green-600 font-medium">
                    {email.sender[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-green-600 transition-colors">
                      {email.sender}
                    </p>
                    <p className="text-xs text-gray-400">{email.time}</p>
                  </div>
                  <p className="text-sm text-gray-900 mt-1 font-medium">
                    {email.subject}
                  </p>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                    {email.preview}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-lg p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-amber-50 rounded-lg">
              <FileText className="h-5 w-5 text-amber-500" />
            </div>
            <h2 className="font-semibold text-gray-900">Recent Files</h2>
          </div>
          <div className="space-y-4">
            {files.map((file) => (
              <div key={file.id} className="flex items-start gap-3 group">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 ring-2 ring-amber-50 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-amber-600 transition-colors">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-400">{file.time}</p>
                  </div>
                  <p className="text-sm text-gray-500">{file.size}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-lg p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-rose-50 rounded-lg">
              <Calendar className="h-5 w-5 text-rose-500" />
            </div>
            <h2 className="font-semibold text-gray-900">Calendar Events</h2>
          </div>
          <div className="space-y-4">
            {calendarEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-3 group">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-rose-50 to-rose-100 ring-2 ring-rose-50 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-rose-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-rose-600 transition-colors">
                      {event.title}
                    </p>
                    <p className="text-xs text-gray-400">{event.date}</p>
                  </div>
                  <p className="text-sm text-gray-500">{event.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
