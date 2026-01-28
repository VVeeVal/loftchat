import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Progress } from '@/components/ui/progress';
import { HardDrive, Cloud, Server } from 'lucide-react';

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getStorageIcon(backend: string) {
    switch (backend.toLowerCase()) {
        case 's3':
        case 'minio':
            return <Cloud className="h-5 w-5" />;
        case 'local':
            return <HardDrive className="h-5 w-5" />;
        default:
            return <Server className="h-5 w-5" />;
    }
}

export function StorageQuotaDisplay() {
    const { data: storageInfo, isLoading, error } = useQuery({
        queryKey: ['storage-info'],
        queryFn: () => api.storage.info(),
    });

    if (isLoading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-20 bg-gray-100 rounded-md"></div>
                <div className="h-20 bg-gray-100 rounded-md"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-sm text-red-500">
                Failed to load storage information
            </div>
        );
    }

    if (!storageInfo) return null;

    const orgUsagePercent = storageInfo.orgQuotaBytes > 0
        ? Math.round((storageInfo.orgUsedBytes / storageInfo.orgQuotaBytes) * 100)
        : 0;

    const userUsagePercent = storageInfo.userQuotaBytes > 0
        ? Math.round((storageInfo.userUsedBytes / storageInfo.userQuotaBytes) * 100)
        : 0;

    const hasOrgQuota = storageInfo.orgQuotaBytes > 0;
    const hasUserQuota = storageInfo.userQuotaBytes > 0;

    return (
        <div className="space-y-6">
            {/* Storage Backend Info */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                {getStorageIcon(storageInfo.storageBackend)}
                <div>
                    <h4 className="text-sm font-semibold capitalize">
                        {storageInfo.storageBackend} Storage
                    </h4>
                    <p className="text-xs text-gray-500">
                        Max file size: {formatBytes(storageInfo.maxUploadSizeBytes)}
                    </p>
                </div>
            </div>

            {/* Organization Storage */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Organization Storage</h4>
                    {hasOrgQuota && (
                        <span className={`text-sm ${orgUsagePercent >= 90 ? 'text-red-500' : orgUsagePercent >= 70 ? 'text-yellow-500' : 'text-gray-500'}`}>
                            {orgUsagePercent}% used
                        </span>
                    )}
                </div>
                {hasOrgQuota ? (
                    <>
                        <Progress value={orgUsagePercent} className="h-2" />
                        <p className="text-xs text-gray-500">
                            {formatBytes(storageInfo.orgUsedBytes)} of {formatBytes(storageInfo.orgQuotaBytes)} used
                        </p>
                        {orgUsagePercent >= 90 && (
                            <p className="text-xs text-red-500">
                                Warning: Organization is running low on storage space.
                            </p>
                        )}
                    </>
                ) : (
                    <p className="text-xs text-gray-500">
                        {formatBytes(storageInfo.orgUsedBytes)} used (unlimited quota)
                    </p>
                )}
            </div>

            {/* User Storage */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Your Storage</h4>
                    {hasUserQuota && (
                        <span className={`text-sm ${userUsagePercent >= 90 ? 'text-red-500' : userUsagePercent >= 70 ? 'text-yellow-500' : 'text-gray-500'}`}>
                            {userUsagePercent}% used
                        </span>
                    )}
                </div>
                {hasUserQuota ? (
                    <>
                        <Progress value={userUsagePercent} className="h-2" />
                        <p className="text-xs text-gray-500">
                            {formatBytes(storageInfo.userUsedBytes)} of {formatBytes(storageInfo.userQuotaBytes)} used
                        </p>
                        {userUsagePercent >= 90 && (
                            <p className="text-xs text-red-500">
                                Warning: You are running low on storage space.
                            </p>
                        )}
                    </>
                ) : (
                    <p className="text-xs text-gray-500">
                        {formatBytes(storageInfo.userUsedBytes)} used (unlimited quota)
                    </p>
                )}
            </div>

            {/* Storage Tips */}
            <div className="text-xs text-gray-400 border-t pt-4">
                <p className="font-semibold mb-1">Tips:</p>
                <ul className="list-disc list-inside space-y-1">
                    <li>Files can be attached to messages in any channel or DM</li>
                    <li>Supported formats include images, documents, and archives</li>
                    <li>Maximum file size: {formatBytes(storageInfo.maxUploadSizeBytes)}</li>
                </ul>
            </div>
        </div>
    );
}
