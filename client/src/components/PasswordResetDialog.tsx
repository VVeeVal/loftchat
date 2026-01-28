import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Copy, Check } from 'lucide-react';
import { api } from '@/lib/api-client';

interface PasswordResetDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export type { PasswordResetDialogProps };

export function PasswordResetDialog({
  isOpen,
  onOpenChange,
  userId,
  userName
}: PasswordResetDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'confirm' | 'display'>('confirm');
  const [newPassword, setNewPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.admin.resetPassword(userId),
    onSuccess: (data) => {
      setNewPassword(data.newPassword);
      setStep('display');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: 'Password Reset',
        description: `Password for ${userName} has been reset. Share the new password securely.`
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to copy password',
        variant: 'destructive'
      });
    }
  };

  const handleReset = () => {
    setStep('confirm');
    setNewPassword('');
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'confirm' ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!mutation.isPending) {
                mutation.mutate();
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Are you sure you want to reset the password for <strong>{userName}</strong>?
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg bg-amber-50 p-3 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                A new password will be generated and displayed once. Make sure to share it securely.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Resetting...' : 'Reset Password'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleReset();
            }}
          >
            <DialogHeader>
              <DialogTitle>New Password Generated</DialogTitle>
              <DialogDescription>
                Password for {userName} has been successfully reset.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-3 space-y-2">
                <label className="text-sm font-medium text-gray-700">New Password</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newPassword}
                    readOnly
                    className="font-mono text-sm bg-white"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopyPassword}
                    className="flex-shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-red-50 p-3 flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800 space-y-1">
                  <p><strong>Important:</strong></p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>This password will only be shown once</li>
                    <li>Share it securely with the user (not via email)</li>
                    <li>The user should change it on first login</li>
                  </ul>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full">
                Done
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
