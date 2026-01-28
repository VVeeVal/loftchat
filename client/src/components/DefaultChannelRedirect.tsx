import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { api } from '@/lib/api-client';

export function DefaultChannelRedirect() {
  const { currentOrganization, loading: orgLoading } = useOrganization();
  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.channels.list(),
    enabled: !!currentOrganization
  });

  if (orgLoading || channelsLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  // Find the general channel
  const generalChannel = channels?.find(
    (c: any) => c.name.toLowerCase() === 'general'
  );

  if (generalChannel) {
    return <Navigate to={`/channels/${generalChannel.id}`} replace />;
  }

  // Fallback to first available channel if general doesn't exist
  if (channels && channels.length > 0) {
    return <Navigate to={`/channels/${channels[0].id}`} replace />;
  }

  // If no channels exist, stay on home (user may need to create one)
  return <div className="flex h-screen items-center justify-center">No channels available</div>;
}
