"use client";

export default function AIServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
