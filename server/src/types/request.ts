import { FastifyRequest } from 'fastify';

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    isAdmin?: boolean;
  };
  session: any;
  organizationContext?: {
    organizationId: string;
    userRole: 'ADMIN' | 'MEMBER';
    userId: string;
    isAdmin: boolean;
  };
}
