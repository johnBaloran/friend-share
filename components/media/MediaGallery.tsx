"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Image, Download, Grid, List, Calendar, Trash2 } from "lucide-react";
import { useDownload } from "@/lib/hooks/useDownload";
import { useDelete } from "@/lib/hooks/useDelete";
import { DeleteConfirmDialog } from "@/components/media/DeleteConfirmDialog";
import { Media } from "@/lib/api/media";

interface MediaGalleryProps {
  media: Media[];
  loading?: boolean;
  groupId: string;
  onDownload?: (mediaIds: string[]) => void;
  onRefresh?: () => void;
  selectedCluster?: string;
}

export function MediaGallery({
  media,
  loading = false,
  groupId,
  onRefresh,
  selectedCluster,
}: MediaGalleryProps) {
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { downloading, downloadSelected } = useDownload({ groupId });
  const { deleting, deleteMultiple } = useDelete({
    onDeleteSuccess: () => {
      setSelectedMedia(new Set());
      setDeleteDialogOpen(false);
      if (onRefresh) {
        onRefresh();
      }
    },
  });

  const toggleSelection = (mediaId: string) => {
    const newSelection = new Set(selectedMedia);
    if (newSelection.has(mediaId)) {
      newSelection.delete(mediaId);
    } else {
      newSelection.add(mediaId);
    }
    setSelectedMedia(newSelection);
  };

  const selectAll = () => {
    if (selectedMedia.size === media.length) {
      setSelectedMedia(new Set());
    } else {
      setSelectedMedia(new Set(media.map((m) => m.id)));
    }
  };

  const handleDownload = async (): Promise<void> => {
    if (selectedMedia.size > 0) {
      await downloadSelected(Array.from(selectedMedia));
      setSelectedMedia(new Set());
    }
  };

  const handleDeleteClick = () => {
    if (selectedMedia.size > 0) {
      setDeleteDialogOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (selectedMedia.size > 0) {
      await deleteMultiple(Array.from(selectedMedia));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Check if any images are being processed
  const hasProcessingImages = media.some((item) => !item.isProcessed);
  const processingCount = media.filter((item) => !item.isProcessed).length;

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
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            {selectedCluster ? "Photos of Person" : "All Photos"}
            {media.length > 0 && (
              <Badge variant="secondary">{media.length}</Badge>
            )}
          </CardTitle>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            >
              {viewMode === "grid" ? (
                <List className="h-4 w-4" />
              ) : (
                <Grid className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {media.length > 0 && (
          <div className="flex items-center justify-between">
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

            {selectedMedia.size > 0 && (
              <div className="flex gap-2">
                <Button
                  onClick={handleDeleteClick}
                  size="sm"
                  variant="destructive"
                  disabled={deleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleting ? "Deleting..." : `Delete (${selectedMedia.size})`}
                </Button>
                <Button onClick={handleDownload} size="sm" disabled={downloading}>
                  <Download className="h-4 w-4 mr-2" />
                  {downloading
                    ? "Downloading..."
                    : `Download (${selectedMedia.size})`}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="relative">
        {/* Processing Overlay - Shows over entire gallery */}
        {hasProcessingImages && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center z-50">
            <div className="text-center px-6 py-8 bg-white/10 rounded-xl border border-white/20">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto mb-4"></div>
              <p className="text-white text-lg font-semibold mb-2">
                Processing {processingCount} {processingCount === 1 ? "photo" : "photos"}...
              </p>
              <p className="text-white/90 text-sm">We'll email you once it's done</p>
            </div>
          </div>
        )}

        {media.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Image className="mx-auto h-16 w-16 mb-4 text-gray-300" />
            <p className="text-lg mb-2">No photos yet</p>
            <p>Upload some photos to get started!</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {media.map((item) => (
              <div key={item.id} className="relative group">
                <div className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                  <img
                    src={item.presignedUrl || item.url}
                    alt={item.originalName}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    loading="lazy"
                  />
                </div>

                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg">
                  <div className="absolute top-2 left-2">
                    <Checkbox
                      checked={selectedMedia.has(item.id)}
                      onCheckedChange={() => toggleSelection(item.id)}
                      className="bg-white"
                    />
                  </div>

                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      onClick={() => {
                        setSelectedMedia(new Set([item.id]));
                        setDeleteDialogOpen(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5"
                      title="Delete photo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs truncate">
                    {item.originalName}
                  </p>
                  <p className="text-white/80 text-xs">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {media.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg"
              >
                <Checkbox
                  checked={selectedMedia.has(item.id)}
                  onCheckedChange={() => toggleSelection(item.id)}
                />

                <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                  <img
                    src={item.presignedUrl || item.url}
                    alt={item.originalName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{item.originalName}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    <span>{formatFileSize(item.fileSize)}</span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedMedia(new Set([item.id]));
                    setDeleteDialogOpen(true);
                  }}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        count={selectedMedia.size}
        loading={deleting}
      />
    </Card>
  );
}
