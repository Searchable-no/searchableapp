"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export function OrganizationSelector() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    async function loadOrganizations() {
      try {
        setLoading(true);

        // Bruk direkte ruten først for å unngå RLS-problemer
        let response = await fetch("/api/organizations/direct");

        // Fallback til standard API hvis direkte rute feiler
        if (!response.ok) {
          console.log("Direkte API feilet, prøver standard rute...");
          response = await fetch("/api/organizations");

          if (!response.ok) {
            throw new Error(
              "Kunne ikke hente organisasjoner fra noen API-ruter"
            );
          }
        }

        const data = await response.json();
        setOrganizations(data.organizations || []);

        // Last valgte org fra lokalt lager eller bruk første
        if (data.organizations?.length > 0) {
          const storedOrgId = localStorage.getItem("selectedOrgId");
          const orgToSelect =
            storedOrgId &&
            data.organizations.some(
              (org: Organization) => org.id === storedOrgId
            )
              ? storedOrgId
              : data.organizations[0].id;

          setSelectedOrgId(orgToSelect);
          localStorage.setItem("selectedOrgId", orgToSelect);
        }
      } catch (error) {
        console.error("Feil ved lasting av organisasjoner:", error);
        toast({
          title: "Feil",
          description: "Kunne ikke laste organisasjoner",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    loadOrganizations();
  }, [toast]);

  const handleOrgChange = (value: string) => {
    setSelectedOrgId(value);
    localStorage.setItem("selectedOrgId", value);

    // Oppdater UI
    router.refresh();

    // Du kan også videreføre hendelsen til andre komponenter gjennom en context provider
  };

  const goToCreateOrg = () => {
    router.push("/settings/organizations/new");
  };

  if (loading) {
    return <div className="w-[180px] h-10 bg-gray-100 animate-pulse rounded" />;
  }

  if (organizations.length === 0) {
    return (
      <Button onClick={goToCreateOrg} size="sm" variant="outline">
        <PlusIcon className="h-4 w-4 mr-2" />
        Opprett organisasjon
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedOrgId || undefined}
        onValueChange={handleOrgChange}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Velg organisasjon" />
        </SelectTrigger>
        <SelectContent>
          {organizations.map((org) => (
            <SelectItem key={org.id} value={org.id}>
              {org.name} ({org.role})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button onClick={goToCreateOrg} size="icon" variant="ghost">
        <PlusIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
