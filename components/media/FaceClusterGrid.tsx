"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Edit2, Save, X, Trash2 } from "lucide-react";
import { Cluster } from "@/lib/api/clusters";

interface FaceClusterGridProps {
  clusters: Cluster[];
  loading?: boolean;
  onClusterSelect: (clusterId: string) => void;
  onClusterUpdate: (
    clusterId: string,
    updates: { clusterName?: string }
  ) => void;
  onClusterDelete: (clusterId: string) => void;
  canEdit?: boolean;
  // Multi-select mode for merging
  selectMode?: boolean;
  selectedClusters?: string[];
  onSelectionChange?: (clusterIds: string[]) => void;
}

export function FaceClusterGrid({
  clusters,
  loading = false,
  onClusterSelect,
  onClusterUpdate,
  onClusterDelete,
  canEdit = true,
  selectMode = false,
  selectedClusters = [],
  onSelectionChange,
}: FaceClusterGridProps) {
  const [editingCluster, setEditingCluster] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const { toast } = useToast();

  const handleClusterToggle = (clusterId: string) => {
    if (!onSelectionChange) return;

    const isSelected = selectedClusters.includes(clusterId);
    if (isSelected) {
      onSelectionChange(selectedClusters.filter((id) => id !== clusterId));
    } else {
      onSelectionChange([...selectedClusters, clusterId]);
    }
  };

  const startEditing = (cluster: Cluster): void => {
    setEditingCluster(cluster.id);
    setEditName(cluster.clusterName || "");
  };

  const cancelEditing = (): void => {
    setEditingCluster(null);
    setEditName("");
  };

  const saveClusterName = async (clusterId: string): Promise<void> => {
    try {
      await onClusterUpdate(clusterId, { clusterName: editName.trim() });
      setEditingCluster(null);
      setEditName("");

      toast({
        title: "Success",
        description: "Person name updated successfully",
      });
    } catch (error) {
      console.error("Failed to update cluster name:", error);
      toast({
        title: "Error",
        description: "Failed to update person name",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (clusterId: string): Promise<void> => {
    try {
      await onClusterDelete(clusterId);
      toast({
        title: "Success",
        description: "Person deleted successfully",
      });
    } catch (error) {
      console.error("Failed to delete cluster:", error);
      toast({
        title: "Error",
        description: "Failed to delete person",
        variant: "destructive",
      });
    }
  };

  // Component to display face thumbnail
  const FaceThumbnail = ({ cluster }: { cluster: Cluster }) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    if (!cluster.samplePhoto?.thumbnailUrl) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <Users className="h-8 w-8 text-gray-400" />
        </div>
      );
    }

    return (
      <div className="relative w-full h-full overflow-hidden bg-gray-100">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
          </div>
        )}
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
        )}
        <img
          src={cluster.samplePhoto.thumbnailUrl}
          alt={cluster.clusterName || "Person"}
          className={`w-full h-full object-cover transition-all duration-300 hover:scale-110 ${
            imageLoaded && !imageError ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            console.error("Failed to load cluster thumbnail:", {
              clusterId: cluster.id,
            });
            setImageError(true);
          }}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <Users className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">People in Photos</h3>
            <p className="text-xs text-gray-500">
              {clusters.length} {clusters.length === 1 ? "person" : "people"}{" "}
              detected
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal Scrollable Face Filter */}
      {loading ? (
        <div className="flex items-center justify-center py-12 bg-gray-50 rounded-xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : clusters.length === 0 ? (
        <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-purple-50 rounded-xl border-2 border-dashed border-gray-200">
          <Users className="mx-auto h-12 w-12 mb-3 text-gray-300" />
          <p className="text-gray-600 font-medium">No people detected yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Upload photos with faces to get started!
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Horizontal scroll container */}
          <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <div className="flex gap-3 min-w-min">
              {clusters.map((cluster) => (
                <div key={cluster.id} className="flex-shrink-0 w-32 group">
                  {editingCluster === cluster.id ? (
                    /* Edit Mode */
                    <div className="bg-white border-2 border-purple-500 rounded-xl p-3 shadow-lg">
                      <Input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-xs mb-2 h-8"
                        placeholder="Name"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveClusterName(cluster.id);
                          if (e.key === "Escape") cancelEditing();
                        }}
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <Button
                          onClick={() => saveClusterName(cluster.id)}
                          size="sm"
                          className="flex-1 h-7 text-xs"
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button
                          onClick={cancelEditing}
                          variant="outline"
                          size="sm"
                          className="flex-1 h-7 text-xs"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Display Mode */
                    <div className={`bg-white rounded-xl border-2 transition-all duration-200 overflow-hidden ${
                      selectMode && selectedClusters.includes(cluster.id)
                        ? "border-purple-500 shadow-lg ring-2 ring-purple-200"
                        : "border-gray-200 hover:border-purple-400 hover:shadow-lg"
                    }`}>
                      {/* Face Image */}
                      <div
                        className="relative aspect-square cursor-pointer overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200"
                        onClick={() => {
                          if (selectMode) {
                            handleClusterToggle(cluster.id);
                          } else {
                            onClusterSelect(cluster.id);
                          }
                        }}
                      >
                        <FaceThumbnail cluster={cluster} />

                        {/* Selection Checkbox (in select mode) */}
                        {selectMode && (
                          <div className="absolute top-2 left-2 z-10">
                            <div className="bg-white rounded-md p-1 shadow-md">
                              <Checkbox
                                checked={selectedClusters.includes(cluster.id)}
                                onCheckedChange={() => handleClusterToggle(cluster.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                        )}

                        {/* Appearance Badge */}
                        <div className="absolute top-1.5 right-1.5">
                          <div className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {cluster.appearanceCount}
                          </div>
                        </div>

                        {/* Confidence Badge (on hover, not in select mode) */}
                        {!selectMode && (
                          <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                cluster.confidence > 0.7
                                  ? "bg-green-500 text-white"
                                  : "bg-yellow-500 text-white"
                              }`}
                            >
                              {Math.round(cluster.confidence * 100)}%
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Info Section */}
                      <div className="p-2">
                        <p
                          className="text-xs font-semibold text-gray-900 truncate cursor-pointer hover:text-purple-600"
                          onClick={() => onClusterSelect(cluster.id)}
                        >
                          {cluster.clusterName || "Unknown"}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {cluster.totalPhotos}{" "}
                          {cluster.totalPhotos === 1 ? "photo" : "photos"}
                        </p>

                        {/* Action Buttons (not in select mode) */}
                        {canEdit && !selectMode && (
                          <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-purple-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(cluster);
                              }}
                            >
                              <Edit2 className="h-3 w-3 text-purple-600" />
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <button
                                  className="h-6 w-6 p-0 hover:bg-red-100 rounded flex items-center justify-center bg-transparent border-0 cursor-pointer"
                                  onClickCapture={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                </button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Delete Person</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <p className="text-sm text-gray-600">
                                    Delete{" "}
                                    {cluster.clusterName || "this person"}? This
                                    cannot be undone.
                                  </p>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => handleDelete(cluster.id)}
                                      variant="destructive"
                                      className="flex-1"
                                    >
                                      Delete
                                    </Button>
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className="flex-1"
                                      >
                                        Cancel
                                      </Button>
                                    </DialogTrigger>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        )}

                        {/* Selection indicator (in select mode) */}
                        {selectMode && selectedClusters.includes(cluster.id) && (
                          <div className="mt-2">
                            <div className="bg-purple-100 text-purple-700 text-[10px] font-semibold px-2 py-1 rounded text-center">
                              Selected
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Scroll Hint (shows if scrollable) */}
          {clusters.length > 6 && (
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none"></div>
          )}
        </div>
      )}
    </div>
  );
}
