"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Edit2, Save, X, Trash2 } from "lucide-react";

interface FaceCluster {
  _id: string;
  clusterName?: string;
  appearanceCount: number;
  confidence: number;
  createdAt: string;
  samplePhoto?: {
    cloudinaryUrl: string;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  totalPhotos: number;
}

interface FaceClusterGridProps {
  clusters: FaceCluster[];
  loading?: boolean;
  onClusterSelect: (clusterId: string) => void;
  onClusterUpdate: (
    clusterId: string,
    updates: { clusterName?: string }
  ) => void;
  onClusterDelete: (clusterId: string) => void;
  canEdit?: boolean;
}

export function FaceClusterGrid({
  clusters,
  loading = false,
  onClusterSelect,
  onClusterUpdate,
  onClusterDelete,
  canEdit = true,
}: FaceClusterGridProps) {
  const [editingCluster, setEditingCluster] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const { toast } = useToast();

  const startEditing = (cluster: FaceCluster): void => {
    setEditingCluster(cluster._id);
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

  const generateCroppedImageUrl = (cluster: FaceCluster): string => {
    if (!cluster.samplePhoto) return "";

    const { cloudinaryUrl, boundingBox } = cluster.samplePhoto;
    const { x, y, width, height } = boundingBox;

    // Create Cloudinary crop transformation
    const baseUrl = cloudinaryUrl.replace(
      "/upload/",
      `/upload/c_crop,x_${x},y_${y},w_${width},h_${height}/c_fill,w_100,h_100/`
    );
    return baseUrl;
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          People in Photos
          {clusters.length > 0 && (
            <Badge variant="secondary">{clusters.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {clusters.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="mx-auto h-12 w-12 mb-2 text-gray-300" />
            <p>No people detected yet</p>
            <p className="text-sm">Upload some photos to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {clusters.map((cluster) => (
              <div key={cluster._id} className="bg-gray-50 rounded-lg p-3">
                <div
                  className="aspect-square bg-gray-200 rounded-lg mb-2 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden relative group"
                  onClick={() => onClusterSelect(cluster._id)}
                >
                  {cluster.samplePhoto ? (
                    <Avatar className="w-full h-full rounded-lg">
                      <AvatarImage
                        src={generateCroppedImageUrl(cluster)}
                        alt="Person preview"
                        className="object-cover"
                      />
                      <AvatarFallback className="rounded-lg">
                        <Users className="h-8 w-8 text-gray-400" />
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="h-8 w-8 text-gray-400" />
                    </div>
                  )}

                  {/* Confidence indicator */}
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Badge
                      variant={
                        cluster.confidence > 0.7 ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {Math.round(cluster.confidence * 100)}%
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  {editingCluster === cluster._id ? (
                    <div className="space-y-2">
                      <Input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-sm"
                        placeholder="Person's name"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            saveClusterName(cluster._id);
                          } else if (e.key === "Escape") {
                            cancelEditing();
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <Button
                          onClick={() => saveClusterName(cluster._id)}
                          size="sm"
                          className="flex-1"
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          onClick={cancelEditing}
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <Button
                          variant="ghost"
                          className="w-full text-left text-sm font-medium truncate hover:text-blue-600 p-0 h-auto justify-start"
                          onClick={() => onClusterSelect(cluster._id)}
                        >
                          {cluster.clusterName || "Unknown Person"}
                        </Button>
                        {canEdit && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => startEditing(cluster)}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Delete Person</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <p className="text-sm text-gray-600">
                                    Are you sure you want to delete this person?
                                    This action cannot be undone.
                                  </p>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => handleDelete(cluster._id)}
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
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">
                          {cluster.totalPhotos} photo
                          {cluster.totalPhotos !== 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-gray-400">
                          {cluster.appearanceCount} face
                          {cluster.appearanceCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
