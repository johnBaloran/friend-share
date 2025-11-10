"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { Cluster } from "@/lib/api/clusters";

interface ClusterMergeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clusters: Cluster[];
  selectedClusterIds: string[];
  onConfirm: (sourceId: string, targetId: string) => Promise<void>;
}

export function ClusterMergeDialog({
  isOpen,
  onClose,
  clusters,
  selectedClusterIds,
  onConfirm,
}: ClusterMergeDialogProps) {
  const [targetClusterId, setTargetClusterId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const selectedClusters = clusters.filter((c) =>
    selectedClusterIds.includes(c.id)
  );

  // Auto-select the cluster with most appearances as target
  if (!targetClusterId && selectedClusters.length > 0) {
    const defaultTarget = selectedClusters.reduce((prev, current) =>
      current.appearanceCount > prev.appearanceCount ? current : prev
    );
    setTargetClusterId(defaultTarget.id);
  }

  const handleMerge = async () => {
    if (!targetClusterId || selectedClusterIds.length < 2) return;

    setIsLoading(true);
    try {
      // Merge all selected clusters into the target
      for (const sourceId of selectedClusterIds) {
        if (sourceId !== targetClusterId) {
          await onConfirm(sourceId, targetClusterId);
        }
      }
      onClose();
    } catch (error) {
      console.error("Failed to merge clusters:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const targetCluster = selectedClusters.find((c) => c.id === targetClusterId);
  const totalAppearances = selectedClusters.reduce(
    (sum, c) => sum + c.appearanceCount,
    0
  );

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Merge People</AlertDialogTitle>
          <AlertDialogDescription>
            Merging {selectedClusterIds.length} people into one. All photos will
            be grouped together.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Merge Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-semibold text-blue-900">
                Merge Summary
              </span>
            </div>
            <div className="text-xs text-blue-700 space-y-1">
              <p>• {selectedClusterIds.length} people will be merged</p>
              <p>• Total {totalAppearances} photo appearances</p>
              <p>
                • {selectedClusterIds.length - 1} duplicate{" "}
                {selectedClusterIds.length - 1 === 1 ? "person" : "people"} will
                be removed
              </p>
            </div>
          </div>

          {/* Choose which cluster to keep */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Choose which person to keep:
            </Label>
            <RadioGroup
              value={targetClusterId}
              onValueChange={setTargetClusterId}
              className="space-y-2"
            >
              {selectedClusters
                .sort((a, b) => b.appearanceCount - a.appearanceCount)
                .map((cluster) => (
                  <div
                    key={cluster.id}
                    className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-all ${
                      targetClusterId === cluster.id
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <RadioGroupItem value={cluster.id} id={cluster.id} />
                    <Label
                      htmlFor={cluster.id}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        {/* Thumbnail */}
                        {cluster.samplePhoto?.thumbnailUrl && (
                          <img
                            src={cluster.samplePhoto.thumbnailUrl}
                            alt={cluster.clusterName || "Person"}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        )}
                        {/* Info */}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {cluster.clusterName || "Unknown"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {cluster.appearanceCount} appearances •{" "}
                            {cluster.totalPhotos} photos
                          </p>
                        </div>
                        {/* Badge for recommended */}
                        {cluster.appearanceCount ===
                          Math.max(
                            ...selectedClusters.map((c) => c.appearanceCount)
                          ) && (
                          <div className="bg-green-100 text-green-700 text-[10px] font-semibold px-2 py-1 rounded-full">
                            Most photos
                          </div>
                        )}
                      </div>
                    </Label>
                  </div>
                ))}
            </RadioGroup>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-800">
              ⚠️ <strong>This action cannot be undone.</strong> All selected
              people will be merged into &quot;
              {targetCluster?.clusterName || "Unknown"}
              &quot;.
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleMerge}
            disabled={!targetClusterId || isLoading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Merge People
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
