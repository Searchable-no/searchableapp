"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewOrganizationPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !slug) {
      toast.error("Vennligst fyll ut alle obligatoriske felt");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          slug: slug.toLowerCase(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Feil ved opprettelse av organisasjon");
      }

      toast.success("Organisasjon opprettet");
      router.push("/settings/organizations");
    } catch (error) {
      console.error("Feil ved opprettelse av organisasjon:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Feil ved opprettelse av organisasjon"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);

    // Autogenerer en slug basert på navnet
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value));
    }
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "") // Fjern spesialtegn
      .replace(/\s+/g, "-") // Erstatt mellomrom med bindestrek
      .replace(/-+/g, "-") // Unngå flere bindestreker på rad
      .trim();
  };

  return (
    <div className="container mx-auto py-8 max-w-md">
      <Link
        href="/settings/organizations"
        className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Tilbake til organisasjoner
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Opprett ny organisasjon</CardTitle>
          <CardDescription>
            En organisasjon lar deg administrere brukere og ressurser sammen.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organisasjonsnavn *</Label>
              <Input
                id="name"
                value={name}
                onChange={handleNameChange}
                placeholder="Min organisasjon"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">
                Slug *
                <span className="text-xs text-gray-500 ml-2">
                  (brukes i URL-er)
                </span>
              </Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="min-organisasjon"
                pattern="^[a-z0-9-]+$"
                title="Kun små bokstaver, tall og bindestrek"
                required
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-between border-t px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/settings/organizations")}
              disabled={loading}
            >
              Avbryt
            </Button>

            <Button type="submit" disabled={loading}>
              {loading ? "Oppretter..." : "Opprett organisasjon"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
