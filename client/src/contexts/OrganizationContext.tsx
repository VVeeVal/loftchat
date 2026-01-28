import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, APIError } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';

export interface Organization {
  id: string;
  name: string;
  description?: string;
  role: 'ADMIN' | 'MEMBER';
  joinedAt?: string;
}

export interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  loading: boolean;
  error: string | null;
  switchOrganization: (organizationId: string) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  createOrganization: (name: string, description?: string) => Promise<Organization>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};

interface OrganizationProviderProps {
  children: ReactNode;
}

export const OrganizationProvider: React.FC<OrganizationProviderProps> = ({ children }) => {
  const { data: session } = authClient.useSession();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch list of organizations
      const data = await api.organizations.list();
      setOrganizations(data.organizations || []);

      let currentData: Organization | null = null;
      try {
        currentData = await api.organizations.current();
      } catch (currentError) {
        console.warn('Failed to fetch current organization', currentError);
      }

      if (currentData?.id) {
        const orgWithRole = data.organizations?.find((o: Organization) => o.id === currentData.id);
        setCurrentOrganization(orgWithRole || currentData);
        return;
      }

      // Fallback: default to first organization if current isn't available yet
      if (data.organizations?.length) {
        setCurrentOrganization(data.organizations[0]);
      }
    } catch (err) {
      if (err instanceof APIError && err.statusCode === 401) {
        setOrganizations([]);
        setCurrentOrganization(null);
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to load organizations';
      setError(message);
      console.error('Error loading organizations:', err);
    } finally {
      setLoading(false);
    }
  };

  const switchOrganization = async (organizationId: string) => {
    try {
      setError(null);

      await api.organizations.switch(organizationId);

      // Refresh organizations to get updated current org
      await refreshOrganizations();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to switch organization';
      setError(message);
      console.error('Error switching organization:', err);
      throw err;
    }
  };

  const createOrganization = async (name: string, description?: string): Promise<Organization> => {
    try {
      setError(null);

      const newOrg = await api.organizations.create(name, description);

      // Refresh organizations list
      await refreshOrganizations();

      return newOrg;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create organization';
      setError(message);
      console.error('Error creating organization:', err);
      throw err;
    }
  };

  // Refresh organizations when session changes
  useEffect(() => {
    if (session?.user?.id) {
      refreshOrganizations();
      return;
    }

    setOrganizations([]);
    setCurrentOrganization(null);
    setLoading(false);
  }, [session?.user?.id]);

  const value: OrganizationContextType = {
    currentOrganization,
    organizations,
    loading,
    error,
    switchOrganization,
    refreshOrganizations,
    createOrganization,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};
