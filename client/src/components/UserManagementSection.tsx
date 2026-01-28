import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { resolveAssetUrl } from '@/lib/assets';

interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  isAdmin: boolean;
  createdAt: string;
}

interface UserManagementSectionProps {
  onResetPassword: (userId: string, userName: string) => void;
}

export function UserManagementSection({ onResetPassword }: UserManagementSectionProps) {
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.admin.listUsers(),
    refetchOnWindowFocus: false
  });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-800">Failed to load users: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-4">User Management</h3>
        <p className="text-sm text-gray-600 mb-4">
          Manage workspace users and reset passwords. Only admins can reset user passwords.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-gray-500">No users found</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr
                  key={user.id}
                  className={idx > 0 ? 'border-t' : ''}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.image && (
                        <img
                          src={resolveAssetUrl(user.image)}
                          alt={user.name || 'User'}
                          className="h-8 w-8 rounded-full"
                        />
                      )}
                      <span>{user.name || 'Unnamed'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.isAdmin ? (
                      <Badge>Admin</Badge>
                    ) : (
                      <Badge variant="outline">Member</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onResetPassword(user.id, user.name || user.email)}
                    >
                      Reset Password
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
