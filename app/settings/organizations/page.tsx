"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PlusIcon, Settings, Users } from "lucide-react";
import Link from "next/link";

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
  ms_tenant_id?: string;
  created_at: string;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadOrganizations() {
      try {
        setLoading(true);
        const response = await fetch("/api/organizations");
        if (!response.ok) {
          throw new Error("Feil ved henting av organisasjoner");
        }

        const data = await response.json();
        setOrganizations(data.organizations || []);
      } catch (error) {
        console.error("Feil ved lasting av organisasjoner:", error);
        toast.error("Kunne ikke laste organisasjoner");
      } finally {
        setLoading(false);
      }
    }

    loadOrganizations();
  }, []);

  const handleCreateOrg = () => {
    router.push("/settings/organizations/new");
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Organisasjoner</h1>
          <p className="text-gray-500 mt-1">
            Administrer organisasjoner og medlemskap
          </p>
        </div>

        <Button onClick={handleCreateOrg}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Ny organisasjon
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-gray-100" />
              <CardContent className="h-32 bg-gray-50" />
            </Card>
          ))}
        </div>
      ) : organizations.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto max-w-md">
            <h2 className="text-xl font-semibold mb-2">Ingen organisasjoner</h2>
            <p className="text-gray-500 mb-6">
              Du har ikke opprettet eller blitt lagt til i noen organisasjoner
              ennå.
            </p>
            <Button onClick={handleCreateOrg}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Opprett din første organisasjon
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {organizations.map((org) => (
            <Card key={org.id} className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {org.name}
                  <Badge
                    variant={org.role === "owner" ? "default" : "secondary"}
                  >
                    {org.role}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {org.slug}
                  {org.ms_tenant_id && (
                    <span className="ml-2 text-xs text-blue-500">
                      Microsoft-tenant tilkoblet
                    </span>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-gray-500">
                  Opprettet: {new Date(org.created_at).toLocaleDateString()}
                </p>
              </CardContent>

              <CardFooter className="flex justify-between border-t bg-gray-50 px-6 py-3">
                <Link href={`/settings/organizations/${org.id}/members`}>
                  <Button variant="ghost" size="sm">
                    <Users className="h-4 w-4 mr-2" />
                    Medlemmer
                  </Button>
                </Link>

                {["owner", "admin"].includes(org.role) && (
                  <Link href={`/settings/organizations/${org.id}`}>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Innstillinger
                    </Button>
                  </Link>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
