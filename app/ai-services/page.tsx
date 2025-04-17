"use client";

import Link from "next/link";
import { Metadata } from "next";
import { FileAudio, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "AI Tjenester | Searchable",
  description: "AI tjenester for transkribering, oppsummering og mer",
};

export default function AIServicesPage() {
  const services = [
    {
      title: "Transkribering",
      description: "Last opp lydfiler og få teksttranskripsjon med AI",
      icon: FileAudio,
      href: "/ai-services/transcription",
    },
    {
      title: "Email",
      description: "Få hjelp med e-post og kommunikasjonsoppgaver",
      icon: Mail,
      href: "/ai-services/email",
    },
  ];

  return (
    <div className="w-full h-full py-10 px-4">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-10 text-center">
          <Sparkles className="mx-auto h-12 w-12 text-primary mb-4" />
          <h1 className="text-3xl font-bold tracking-tight">AI Tjenester</h1>
          <p className="mt-4 text-muted-foreground">
            Velg en av våre AI-drevne tjenester for å øke produktiviteten
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {services.map((service) => (
            <Link key={service.href} href={service.href} className="block">
              <div className="group rounded-lg border bg-card p-6 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <service.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold">{service.title}</h2>
                    <p className="mt-2 text-muted-foreground">
                      {service.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 text-right">
                  <Button
                    variant="outline"
                    className="group-hover:bg-primary/5"
                  >
                    Åpne
                  </Button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
