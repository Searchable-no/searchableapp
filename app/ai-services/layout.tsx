"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { FileAudio, Mail } from "lucide-react";

export default function AIServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const menuItems = [
    {
      name: "Transkribering",
      href: "/ai-services/transcription",
      icon: FileAudio,
    },
    {
      name: "Email",
      href: "/ai-services/email",
      icon: Mail,
    },
  ];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-background h-full overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">AI Services</h2>
        </div>
        <nav className="p-2">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
