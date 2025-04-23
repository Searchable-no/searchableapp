"use client";

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

interface Organization {
  id: string;
  name: string;
  slug: string;
  ms_tenant_id?: string;
  role: string;
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrganization: Organization | null;
  loading: boolean;
  error: string | null;
  setCurrentOrganization: (organization: Organization) => void;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] =
    useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);

      // Bruk direkte API-ruten for å unngå RLS-problemer
      const response = await fetch("/api/organizations/direct");

      if (!response.ok) {
        throw new Error("Kunne ikke hente organisasjoner");
      }

      const data = await response.json();
      return data.organizations || [];
    } catch (err) {
      console.error("Feil ved henting av organisasjoner:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Ukjent feil ved henting av organisasjoner"
      );
      return [];
    } finally {
      setLoading(false);
    }
  };

  const refreshOrganizations = async () => {
    const orgs = await fetchOrganizations();
    setOrganizations(orgs);

    // Behold nåværende organisasjon hvis den fortsatt er i listen
    if (
      currentOrganization &&
      orgs.some((o: Organization) => o.id === currentOrganization.id)
    ) {
      const updated = orgs.find(
        (o: Organization) => o.id === currentOrganization.id
      )!;
      setCurrentOrganization(updated);
      localStorage.setItem("selectedOrgId", updated.id);
    } else if (orgs.length > 0) {
      // Velg første organisasjon hvis nåværende ikke finnes lenger
      setCurrentOrganization(orgs[0]);
      localStorage.setItem("selectedOrgId", orgs[0].id);
    } else {
      // Ingen organisasjoner tilgjengelig
      setCurrentOrganization(null);
      localStorage.removeItem("selectedOrgId");
    }
  };

  const handleSetCurrentOrganization = (organization: Organization) => {
    setCurrentOrganization(organization);
    localStorage.setItem("selectedOrgId", organization.id);
    router.refresh();
  };

  useEffect(() => {
    const initializeOrganizations = async () => {
      const orgs = await fetchOrganizations();
      setOrganizations(orgs);

      if (orgs.length > 0) {
        // Last valgt organisasjon fra localStorage eller bruk første
        const storedOrgId = localStorage.getItem("selectedOrgId");
        const selectedOrg = storedOrgId
          ? orgs.find((org: Organization) => org.id === storedOrgId)
          : orgs[0];

        if (selectedOrg) {
          setCurrentOrganization(selectedOrg);
          localStorage.setItem("selectedOrgId", selectedOrg.id);
        } else if (orgs[0]) {
          setCurrentOrganization(orgs[0]);
          localStorage.setItem("selectedOrgId", orgs[0].id);
        }
      }
    };

    initializeOrganizations();
  }, []);

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrganization,
        loading,
        error,
        setCurrentOrganization: handleSetCurrentOrganization,
        refreshOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);

  if (context === undefined) {
    throw new Error(
      "useOrganization må brukes innenfor en OrganizationProvider"
    );
  }

  return context;
}
