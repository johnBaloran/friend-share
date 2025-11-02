"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  HardDrive,
  Trash2,
  Clock,
  Copy,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { groupsApi } from "@/lib/api/groups";

interface StorageAnalytics {
  totalStorage: number;
  usedStorage: number;
  availableStorage: number;
  usagePercentage: number;
  mediaByType?: {
    images: number;
    processed: number;
    unprocessed: number;
  };
  largestFiles?: Array<{
    id: string;
    filename: string;
    originalName: string;
    fileSize: number;
    createdAt: string;
  }>;
  oldestFiles?: Array<{
    id: string;
    filename: string;
    originalName: string;
    createdAt: string;
    fileSize: number;
  }>;
  duplicateCandidates?: Array<{
    filename: string;
    count: number;
    totalSize: number;
    items: Array<{
      id: string;
      createdAt: string;
    }>;
  }>;
}

interface StorageManagerProps {
  groupId: string;
  isAdmin: boolean;
}

export function StorageManager({ groupId, isAdmin }: StorageManagerProps) {
  const [analytics, setAnalytics] = useState<StorageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const { toast } = useToast();

  const loadAnalytics = async (): Promise<void> => {
    try {
      const data = await groupsApi.getStorage(groupId);
      // Map backend StorageInfo to StorageAnalytics
      const analytics: StorageAnalytics = {
        totalStorage: data.limit,
        usedStorage: data.used,
        availableStorage: data.limit - data.used,
        usagePercentage: data.percentage,
        mediaByType: {
          images: data.files,
          processed: 0, // Backend doesn't provide this yet
          unprocessed: 0, // Backend doesn't provide this yet
        },
        largestFiles: [], // Backend doesn't provide this yet
        oldestFiles: [], // Backend doesn't provide this yet
        duplicateCandidates: [], // Backend doesn't provide this yet
      };
      setAnalytics(analytics);
    } catch (error) {
      console.error("Failed to load storage analytics:", error);
      toast({
        title: "Error",
        description: "Failed to load storage information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [groupId]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const performCleanup = async (options: {
    type: "duplicates" | "old" | "large" | "unprocessed";
    days?: number;
    size?: number;
  }): Promise<void> => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admins can perform cleanup operations",
        variant: "destructive",
      });
      return;
    }

    setCleanupLoading(true);

    try {
      const cleanupOptions: {
        deleteOlderThan?: string;
        deleteLargerThan?: number;
        deleteUnprocessed?: boolean;
        deleteDuplicates?: boolean;
      } = {};

      switch (options.type) {
        case "duplicates":
          cleanupOptions.deleteDuplicates = true;
          break;
        case "old":
          if (options.days) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - options.days);
            cleanupOptions.deleteOlderThan = cutoffDate.toISOString();
          }
          break;
        case "large":
          if (options.size) {
            cleanupOptions.deleteLargerThan = options.size;
          }
          break;
        case "unprocessed":
          cleanupOptions.deleteUnprocessed = true;
          break;
      }

      const result = await groupsApi.cleanup(groupId, cleanupOptions);

      toast({
        title: "Cleanup Complete",
        description: `Deleted ${result.deletedCount} files, freed ${Math.round(result.freedSpace / 1024 / 1024)} MB`,
      });
      await loadAnalytics(); // Refresh analytics
    } catch (error) {
      console.error("Cleanup failed:", error);
      toast({
        title: "Cleanup Failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-gray-500">Failed to load storage information</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Storage Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Used</span>
              <span>
                {formatFileSize(analytics.usedStorage)} /{" "}
                {formatFileSize(analytics.totalStorage)}
              </span>
            </div>
            <Progress value={analytics.usagePercentage} className="h-3" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{analytics.usagePercentage}% used</span>
              <span>
                {formatFileSize(analytics.availableStorage)} available
              </span>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">
                {analytics.mediaByType?.images || 0}
              </p>
              <p className="text-sm text-gray-500">Total Photos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {analytics.mediaByType?.processed || 0}
              </p>
              <p className="text-sm text-gray-500">Processed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">
                {analytics.mediaByType?.unprocessed || 0}
              </p>
              <p className="text-sm text-gray-500">Processing</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cleanup Options */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Storage Cleanup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Duplicates */}
              {analytics.duplicateCandidates && analytics.duplicateCandidates.length > 0 && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Copy className="h-4 w-4" />
                      <span className="font-medium">Duplicate Files</span>
                    </div>
                    <Badge variant="destructive">
                      {analytics.duplicateCandidates.length} groups
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Remove duplicate photos to save space
                  </p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="w-full">
                        Clean Duplicates
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Remove Duplicate Files</DialogTitle>
                        <DialogDescription>
                          This will keep the newest copy of each duplicate file
                          and remove the rest. This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          {analytics.duplicateCandidates
                            .slice(0, 5)
                            .map((dup, index) => (
                              <div
                                key={index}
                                className="flex justify-between text-sm"
                              >
                                <span>{dup.filename}</span>
                                <span>{dup.count} copies</span>
                              </div>
                            ))}
                          {analytics.duplicateCandidates.length > 5 && (
                            <p className="text-xs text-gray-500">
                              +{analytics.duplicateCandidates.length - 5} more
                              groups
                            </p>
                          )}
                        </div>
                        <Button
                          onClick={() => performCleanup({ type: "duplicates" })}
                          disabled={cleanupLoading}
                          className="w-full"
                        >
                          {cleanupLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Remove Duplicates
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              {/* Old Files */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">Old Files</span>
                  </div>
                  <Badge variant="secondary">
                    {analytics.oldestFiles?.length || 0}+ files
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Remove files older than 90 days
                </p>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="w-full">
                      Clean Old Files
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Remove Old Files</DialogTitle>
                      <DialogDescription>
                        This will permanently delete all files older than 90
                        days. This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center gap-2 p-4 bg-yellow-50 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <p className="text-sm text-yellow-800">
                        This will permanently delete old photos and their face
                        detection data.
                      </p>
                    </div>
                    <Button
                      onClick={() => performCleanup({ type: "old", days: 90 })}
                      disabled={cleanupLoading}
                      variant="destructive"
                      className="w-full"
                    >
                      {cleanupLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Delete Old Files
                    </Button>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Storage Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Largest Files */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Largest Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.largestFiles && analytics.largestFiles.length > 0 ? (
                analytics.largestFiles.slice(0, 5).map((file) => (
                  <div
                    key={file.id}
                    className="flex justify-between items-center"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {file.originalName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(file.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {formatFileSize(file.fileSize)}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No file data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Oldest Files */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Oldest Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.oldestFiles && analytics.oldestFiles.length > 0 ? (
                analytics.oldestFiles.slice(0, 5).map((file) => (
                  <div
                    key={file.id}
                    className="flex justify-between items-center"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {file.originalName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.fileSize)}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-2 text-xs">
                      {new Date(file.createdAt).toLocaleDateString()}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No file data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
