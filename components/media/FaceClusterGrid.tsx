"use client";

import { useState, useEffect, useRef } from "react";
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
    s3Key?: string;
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

  // Component to crop and display face from full image
  const FaceThumbnail = ({ cluster }: { cluster: FaceCluster }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [croppedImage, setCroppedImage] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [useProxy, setUseProxy] = useState(false);

    useEffect(() => {
      if (!cluster.samplePhoto) {
        setLoading(false);
        return;
      }

      const { cloudinaryUrl, s3Key, boundingBox } = cluster.samplePhoto;
      if (!cloudinaryUrl || !boundingBox) {
        setLoading(false);
        return;
      }

      // Determine which URL to use
      let imageUrl = cloudinaryUrl;
      if (useProxy && s3Key) {
        imageUrl = `/api/media/proxy?key=${encodeURIComponent(s3Key)}`;
      }

      const img = new Image();
      // For S3 presigned URLs, we need to use 'anonymous' CORS mode
      // The S3 bucket must have CORS configured to allow this
      img.crossOrigin = "anonymous";

      img.onload = () => {
        try {
          const canvas = canvasRef.current;
          if (!canvas) {
            console.error("Canvas ref not available");
            setLoading(false);
            return;
          }

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            console.error("Could not get 2D context");
            setLoading(false);
            return;
          }

          // AWS Rekognition bounding box is in ratios (0-1)
          const imgWidth = img.naturalWidth || img.width;
          const imgHeight = img.naturalHeight || img.height;

          console.log(`Processing face for cluster ${cluster._id}:`, {
            imageSize: { width: imgWidth, height: imgHeight },
            boundingBox,
            url: imageUrl.substring(0, 50) + "...",
          });

          // Convert ratio to pixels
          const cropX = boundingBox.x * imgWidth;
          const cropY = boundingBox.y * imgHeight;
          const cropWidth = boundingBox.width * imgWidth;
          const cropHeight = boundingBox.height * imgHeight;

          // Add 20% padding around the face for better context
          const padding = 0.2;
          const paddedX = Math.max(0, cropX - cropWidth * padding);
          const paddedY = Math.max(0, cropY - cropHeight * padding);
          const paddedWidth = Math.min(
            imgWidth - paddedX,
            cropWidth * (1 + padding * 2)
          );
          const paddedHeight = Math.min(
            imgHeight - paddedY,
            cropHeight * (1 + padding * 2)
          );

          console.log(`Cropping details:`, {
            crop: { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
            padded: {
              x: paddedX,
              y: paddedY,
              width: paddedWidth,
              height: paddedHeight,
            },
          });

          // Set canvas size to 100x100 for consistent thumbnails
          canvas.width = 100;
          canvas.height = 100;

          // Draw cropped and resized image
          ctx.drawImage(
            img,
            paddedX,
            paddedY,
            paddedWidth,
            paddedHeight,
            0,
            0,
            100,
            100
          );

          // Convert to data URL
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          console.log(
            `Successfully cropped face for ${cluster._id}, data URL length:`,
            dataUrl.length
          );
          setCroppedImage(dataUrl);
          setLoading(false);
        } catch (error) {
          console.error("Error during face cropping:", error);
          setLoading(false);
        }
      };

      img.onerror = (error) => {
        console.error("Failed to load image:", {
          url: imageUrl,
          useProxy,
          error,
          clusterId: cluster._id,
        });

        // If direct S3 URL failed and we haven't tried proxy yet, try proxy
        if (!useProxy && s3Key) {
          console.log("Retrying with proxy...");
          setUseProxy(true);
        } else {
          setLoading(false);
        }
      };

      // Load the image
      img.src = imageUrl;
    }, [cluster.samplePhoto, useProxy]);

    return (
      <>
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
          </div>
        ) : croppedImage ? (
          <img
            src={croppedImage}
            alt={cluster.clusterName || "Person"}
            className="object-cover w-full h-full hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
        )}
      </>
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
              {clusters.length} {clusters.length === 1 ? "person" : "people"} detected
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
          <p className="text-sm text-gray-500 mt-1">Upload photos with faces to get started!</p>
        </div>
      ) : (
        <div className="relative">
          {/* Horizontal scroll container */}
          <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <div className="flex gap-3 min-w-min">
              {clusters.map((cluster) => (
                <div
                  key={cluster._id}
                  className="flex-shrink-0 w-32 group"
                >
                  {editingCluster === cluster._id ? (
                    /* Edit Mode */
                    <div className="bg-white border-2 border-purple-500 rounded-xl p-3 shadow-lg">
                      <Input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-xs mb-2 h-8"
                        placeholder="Name"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveClusterName(cluster._id);
                          if (e.key === "Escape") cancelEditing();
                        }}
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <Button
                          onClick={() => saveClusterName(cluster._id)}
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
                    <div className="bg-white rounded-xl border border-gray-200 hover:border-purple-400 hover:shadow-lg transition-all duration-200 overflow-hidden">
                      {/* Face Image */}
                      <div
                        className="relative aspect-square cursor-pointer overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200"
                        onClick={() => onClusterSelect(cluster._id)}
                      >
                        <FaceThumbnail cluster={cluster} />

                        {/* Appearance Badge */}
                        <div className="absolute top-1.5 right-1.5">
                          <div className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {cluster.appearanceCount}
                          </div>
                        </div>

                        {/* Confidence Badge (on hover) */}
                        <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            cluster.confidence > 0.7
                              ? "bg-green-500 text-white"
                              : "bg-yellow-500 text-white"
                          }`}>
                            {Math.round(cluster.confidence * 100)}%
                          </div>
                        </div>
                      </div>

                      {/* Info Section */}
                      <div className="p-2">
                        <p
                          className="text-xs font-semibold text-gray-900 truncate cursor-pointer hover:text-purple-600"
                          onClick={() => onClusterSelect(cluster._id)}
                        >
                          {cluster.clusterName || "Unknown"}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {cluster.totalPhotos} {cluster.totalPhotos === 1 ? "photo" : "photos"}
                        </p>

                        {/* Action Buttons */}
                        {canEdit && (
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-red-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Delete Person</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <p className="text-sm text-gray-600">
                                    Delete {cluster.clusterName || "this person"}? This cannot be undone.
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
                                      <Button variant="outline" className="flex-1">
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
