"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Download, User, Calendar, FileImage } from "lucide-react";

interface FaceDetection {
  _id: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

interface MediaWithFaces {
  _id: string;
  filename: string;
  originalName: string;
  cloudinaryUrl: string;
  createdAt: string;
  uploader: {
    name?: string;
    email: string;
  };
  fileSize: number;
  processed: boolean;
  faceDetections: FaceDetection[];
}

interface ClusterInfo {
  _id: string;
  clusterName?: string;
  appearanceCount: number;
}

interface PersonMediaGalleryProps {
  media: MediaWithFaces[];
  cluster: ClusterInfo;
  loading?: boolean;
  onBack: () => void;
  onDownload?: (mediaIds: string[]) => void;
}

export function PersonMediaGallery({
  media,
  cluster,
  loading = false,
  onBack,
  onDownload,
}: PersonMediaGalleryProps) {
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());

  const toggleSelection = (mediaId: string): void => {
    const newSelection = new Set(selectedMedia);
    if (newSelection.has(mediaId)) {
      newSelection.delete(mediaId);
    } else {
      newSelection.add(mediaId);
    }
    setSelectedMedia(newSelection);
  };

  const selectAll = (): void => {
    if (selectedMedia.size === media.length) {
      setSelectedMedia(new Set());
    } else {
      setSelectedMedia(new Set(media.map((m) => m._id)));
    }
  };

  const handleDownload = (): void => {
    if (selectedMedia.size > 0 && onDownload) {
      onDownload(Array.from(selectedMedia));
      setSelectedMedia(new Set());
    }
  };

  const generateCroppedFaceUrl = (mediaItem: MediaWithFaces): string => {
    if (mediaItem.faceDetections.length === 0) return mediaItem.cloudinaryUrl;

    // Use the first face detection for the crop
    const face = mediaItem.faceDetections[0];
    const { x, y, width, height } = face.boundingBox;

    // Create Cloudinary crop transformation for face preview
    const baseUrl = mediaItem.cloudinaryUrl.replace(
      "/upload/",
      `/upload/c_crop,x_${x},y_${y},w_${width},h_${height}/c_fill,w_150,h_150/`
    );
    return baseUrl;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {cluster.clusterName || "Unknown Person"}
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                {media.length} photo{media.length !== 1 ? "s" : ""} •{" "}
                {cluster.appearanceCount} face
                {cluster.appearanceCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {media.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={
                    selectedMedia.size === media.length && media.length > 0
                  }
                  onCheckedChange={selectAll}
                />
                <span className="text-sm">
                  {selectedMedia.size > 0
                    ? `${selectedMedia.size} selected`
                    : "Select all"}
                </span>
              </label>
            </div>

            {selectedMedia.size > 0 && onDownload && (
              <Button onClick={handleDownload} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download ({selectedMedia.size})
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {media.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileImage className="mx-auto h-16 w-16 mb-4 text-gray-300" />
            <p className="text-lg mb-2">No photos found</p>
            <p>This person doesnt appear in any photos yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {media.map((item) => (
              <div key={item._id} className="relative group">
                <div className="aspect-square bg-gray-200 rounded-lg overflow-hidden relative">
                  {/* Face crop preview */}
                  <div className="absolute top-2 left-2 z-10">
                    <Avatar className="w-8 h-8 border-2 border-white shadow-sm">
                      <AvatarImage
                        src={generateCroppedFaceUrl(item)}
                        alt="Face preview"
                      />
                      <AvatarFallback className="text-xs">
                        <User className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  {/* Full image */}
                  <img
                    src={item.cloudinaryUrl}
                    alt={item.originalName}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    loading="lazy"
                  />

                  {/* Selection overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity">
                    <div className="absolute top-2 right-2">
                      <Checkbox
                        checked={selectedMedia.has(item._id)}
                        onCheckedChange={() => toggleSelection(item._id)}
                        className="bg-white"
                      />
                    </div>

                    {!item.processed && (
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="secondary" className="text-xs">
                          Processing...
                        </Badge>
                      </div>
                    )}

                    {item.faceDetections.length > 1 && (
                      <div className="absolute bottom-2 right-2">
                        <Badge variant="default" className="text-xs">
                          +{item.faceDetections.length - 1} face
                          {item.faceDetections.length > 2 ? "s" : ""}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Image info */}
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-600 truncate">
                    {item.originalName}
                  </p>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    <span>{formatFileSize(item.fileSize)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
