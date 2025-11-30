"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Settings,
  Users,
  Image,
  Calendar,
  Download,
  Upload,
  AlertCircle,
  UserPlus,
  Pencil,
  Trash2,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { GroupSettingsModal } from "@/components/groups/GroupSettingsModal";
import { InvitePeopleDialog } from "@/components/groups/InvitePeopleDialog";
import { FaceGroupingSkeleton } from "@/components/groups/FaceGroupingSkeleton";
import { groupsApi, Group } from "@/lib/api/groups";
import { mediaApi, Media } from "@/lib/api/media";
import {
  clustersApi,
  Cluster,
  MediaWithFaceInfo,
  FaceDetection,
} from "@/lib/api/clusters";
import { format } from "date-fns";

export default function GroupDetailPage() {
  const params = useParams();
  const { user } = useUser();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreMedia, setHasMoreMedia] = useState(true);
  const [totalMediaCount, setTotalMediaCount] = useState(0);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(
    null
  );
  const [filteredMedia, setFilteredMedia] = useState<
    (Media | MediaWithFaceInfo)[]
  >([]);
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [editingClusterId, setEditingClusterId] = useState<string | null>(null);
  const [editingClusterName, setEditingClusterName] = useState("");

  // Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [mediaToDelete, setMediaToDelete] = useState<Media | null>(null);
  const [showDeleteClusterDialog, setShowDeleteClusterDialog] = useState(false);
  const [clusterToDelete, setClusterToDelete] = useState<Cluster | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState(false);
  const [deletingCluster, setDeletingCluster] = useState(false);

  const loadGroup = useCallback(async () => {
    try {
      const group = await groupsApi.getById(groupId);
      setGroup(group);
    } catch (error) {
      console.error("Failed to load group:", error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const loadMedia = useCallback(
    async (page: number = 1, append: boolean = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setMediaLoading(true);
      }

      try {
        const response = await mediaApi.listByGroup(groupId, page, 20);
        const newMedia = response.data || [];

        // Update media list (replace or append)
        if (append) {
          setMedia((prev) => [...prev, ...newMedia]);
        } else {
          setMedia(newMedia);
        }

        // Update pagination state
        if (response.pagination) {
          setTotalMediaCount(response.pagination.total);
          setCurrentPage(response.pagination.page);
          setHasMoreMedia(
            response.pagination.page < response.pagination.totalPages
          );
        } else {
          setTotalMediaCount(newMedia.length);
          setHasMoreMedia(false);
        }
      } catch (error) {
        console.error("Failed to load media:", error);
      } finally {
        setMediaLoading(false);
        setLoadingMore(false);
      }
    },
    [groupId]
  );

  const loadClusters = useCallback(async () => {
    try {
      const clusters = await clustersApi.listByGroup(groupId);
      setClusters(clusters || []);
    } catch (error) {
      console.error("Failed to load clusters:", error);
    }
  }, [groupId]);

  const loadMoreMedia = useCallback(async () => {
    if (!hasMoreMedia || loadingMore) return;
    await loadMedia(currentPage + 1, true);
  }, [hasMoreMedia, loadingMore, currentPage, loadMedia]);

  // Check if face grouping is in progress
  const isProcessing = media.some((m) => !m.isProcessed);

  useEffect(() => {
    if (user && groupId) {
      loadGroup();
      loadMedia();
      loadClusters();
    }
  }, [user, groupId, loadGroup, loadMedia, loadClusters]);

  // Auto-refresh while processing
  useEffect(() => {
    if (isProcessing) {
      const interval = setInterval(() => {
        loadMedia();
        loadClusters();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [isProcessing, loadMedia, loadClusters]);

  useEffect(() => {
    const loadFilteredMedia = async () => {
      if (selectedClusterId === "ungrouped") {
        // Show photos that aren't in any cluster
        setFilterLoading(true);
        setFilteredMedia([]);
        try {
          // Step 1: Load ALL media from the group
          let allGroupMedia: Media[] = [];
          let page = 1;
          let hasMore = true;
          const limit = 100;

          while (hasMore) {
            const response = await mediaApi.listByGroup(groupId, page, limit);
            allGroupMedia = [...allGroupMedia, ...(response.data || [])];

            if (response.pagination) {
              hasMore = page < response.pagination.totalPages;
              page++;
            } else {
              hasMore = false;
            }
          }

          // Step 2: Get all media IDs that are in clusters
          const mediaIdsInClusters = new Set<string>();

          for (const cluster of clusters) {
            let clusterPage = 1;
            let clusterHasMore = true;

            while (clusterHasMore) {
              const clusterMedia = await clustersApi.getClusterMedia(
                cluster.id,
                clusterPage,
                limit
              );

              clusterMedia.media?.forEach((m) => {
                mediaIdsInClusters.add(m.id);
              });

              if (clusterMedia.pagination) {
                clusterHasMore =
                  clusterPage < clusterMedia.pagination.totalPages;
                clusterPage++;
              } else {
                clusterHasMore = false;
              }
            }
          }

          // Step 3: Filter to show only media NOT in any cluster
          const ungroupedMedia = allGroupMedia.filter(
            (m) => !mediaIdsInClusters.has(m.id)
          );
          setFilteredMedia(ungroupedMedia);
        } catch (error) {
          console.error("Failed to load ungrouped media:", error);
          setFilteredMedia([]);
        } finally {
          setFilterLoading(false);
        }
      } else if (selectedClusterId) {
        // Load ALL media for the selected cluster with pagination
        try {
          let allMedia: MediaWithFaceInfo[] = [];
          let page = 1;
          let hasMore = true;
          const limit = 100;

          while (hasMore) {
            const clusterMedia = await clustersApi.getClusterMedia(
              selectedClusterId,
              page,
              limit
            );
            allMedia = [...allMedia, ...(clusterMedia.media || [])];

            if (clusterMedia.pagination) {
              hasMore = page < clusterMedia.pagination.totalPages;
              page++;
            } else {
              hasMore = false;
            }
          }

          setFilteredMedia(allMedia);
        } catch (error) {
          console.error("Failed to load cluster media:", error);
          setFilteredMedia([]);
        }
      } else {
        // Show all media
        setFilteredMedia(media);
      }
    };

    loadFilteredMedia();
  }, [selectedClusterId, media, clusters, groupId]);

  const handleFileUpload = async (files: FileList) => {
    setUploadingFiles(true);
    try {
      await mediaApi.upload(groupId, Array.from(files));
      await loadMedia();
      await loadGroup();
      setShowUploadDialog(false);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload files");
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleBulkDownload = async () => {
    const mediaToDownload =
      selectedMedia.length > 0 ? selectedMedia : filteredMedia.map((m) => m.id);

    if (mediaToDownload.length === 0) {
      alert("No photos to download");
      return;
    }

    if (mediaToDownload.length > 100) {
      if (
        !confirm(
          `You're about to download ${mediaToDownload.length} photos. This may take a while. Continue?`
        )
      ) {
        return;
      }
    }

    try {
      await mediaApi.bulkDownload(groupId, mediaToDownload);
    } catch (error) {
      console.error("Bulk download failed:", error);
      alert("Failed to download photos. Please try again.");
    }
  };

  const toggleMediaSelection = (mediaId: string) => {
    setSelectedMedia((prev) =>
      prev.includes(mediaId)
        ? prev.filter((id) => id !== mediaId)
        : [...prev, mediaId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedMedia.length === filteredMedia.length) {
      setSelectedMedia([]);
    } else {
      setSelectedMedia(filteredMedia.map((m) => m.id));
    }
  };

  const handleStartEditCluster = (cluster: Cluster) => {
    setEditingClusterId(cluster.id);
    setEditingClusterName(cluster.clusterName || "");
    setShowRenameDialog(true);
  };

  const handleSaveClusterName = async () => {
    if (!editingClusterId) return;

    try {
      await clustersApi.updateCluster(editingClusterId, {
        clusterName: editingClusterName,
      });

      await loadClusters();
      setShowRenameDialog(false);
      setEditingClusterId(null);
      setEditingClusterName("");
    } catch (error) {
      console.error("Failed to update cluster name:", error);
      alert("Failed to update name");
    }
  };

  const handleCancelEditCluster = () => {
    setShowRenameDialog(false);
    setEditingClusterId(null);
    setEditingClusterName("");
  };

  const handleDeleteClick = (media: Media, e: React.MouseEvent) => {
    e.stopPropagation();
    setMediaToDelete(media);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!mediaToDelete) return;

    setDeletingMedia(true);
    try {
      await mediaApi.delete(mediaToDelete.id);

      await loadMedia();
      await loadGroup();

      setShowDeleteDialog(false);
      setMediaToDelete(null);

      setSelectedMedia((prev) => prev.filter((id) => id !== mediaToDelete.id));
    } catch (error: unknown) {
      console.error("Failed to delete media:", error);
      const message =
        error instanceof Error ? error.message : "Failed to delete photo";
      alert(message);
    } finally {
      setDeletingMedia(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false);
    setMediaToDelete(null);
  };

  const handleDeleteClusterClick = (cluster: Cluster, e: React.MouseEvent) => {
    e.stopPropagation();
    setClusterToDelete(cluster);
    setShowDeleteClusterDialog(true);
  };

  const handleDeleteClusterConfirm = async () => {
    if (!clusterToDelete) return;

    setDeletingCluster(true);
    try {
      await clustersApi.deleteCluster(clusterToDelete.id);

      await loadMedia();
      await loadClusters();
      await loadGroup();

      setShowDeleteClusterDialog(false);
      setClusterToDelete(null);

      if (selectedClusterId === clusterToDelete.id) {
        setSelectedClusterId(null);
      }
    } catch (error: unknown) {
      console.error("Failed to delete cluster:", error);
      const message =
        error instanceof Error ? error.message : "Failed to delete person";
      alert(message);
    } finally {
      setDeletingCluster(false);
    }
  };

  const handleDeleteClusterCancel = () => {
    setShowDeleteClusterDialog(false);
    setClusterToDelete(null);
  };

  const canDeleteMedia = (media: Media): boolean => {
    if (!user || !group) return false;

    // Admin can delete any photo
    if (group.creatorId === user.id) return true;

    // Others can only delete their own uploads
    return media.uploaderId === user.id;
  };

  const handleRemoveFaceFromCluster = async (
    faceDetectionId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    if (!selectedClusterId || selectedClusterId === "ungrouped") return;

    if (
      !confirm(
        "Remove this face from the cluster? The photo will remain, but this face won't be grouped with this person anymore."
      )
    ) {
      return;
    }

    try {
      const result = await clustersApi.removeFaceFromCluster(
        selectedClusterId,
        faceDetectionId
      );

      if (result.clusterDeleted) {
        setSelectedClusterId(null);
        alert("Cluster deleted as it became empty.");
      }

      await loadClusters();

      const currentCluster = selectedClusterId;
      setSelectedClusterId(null);
      setTimeout(() => setSelectedClusterId(currentCluster), 100);
    } catch (error: unknown) {
      console.error("Failed to remove face from cluster:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to remove face from cluster";
      alert(message);
    }
  };

  const formatStorageUsed = (bytes: number) => {
    return `${Math.round(bytes / 1024 / 1024)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading group...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Group Not Found
              </h2>
              <p className="text-gray-600 mb-4">
                This group doesn&apos;t exist or you don&apos;t have access to
                it.
              </p>
              <Link href="/dashboard">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <Header />

      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">
                  {group.name}
                </h1>
                {user && group.creatorId === user.id && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                    Admin
                  </span>
                )}
                {user && group.creatorId !== user.id && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                    Viewer
                  </span>
                )}
              </div>
              {group.description && (
                <p className="text-gray-600 mt-1">{group.description}</p>
              )}
            </div>

            {/* Admin Actions */}
            {user && group.creatorId === user.id && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInviteDialog(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettingsModal(true)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
            <button
              onClick={() => setShowMembersDialog(true)}
              className="flex items-center gap-1 hover:text-blue-600 transition-colors cursor-pointer"
            >
              <Users className="h-4 w-4" />
              {group.members.length}{" "}
              {group.members.length === 1 ? "member" : "members"}
            </button>
            <div className="flex items-center gap-1">
              <Image className="h-4 w-4" />
              {totalMediaCount} {totalMediaCount === 1 ? "photo" : "photos"}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Created {format(new Date(group.createdAt), "MMM dd, yyyy")}
            </div>
            {user && group.creatorId === user.id && (
              <div className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full">
                <span className="font-medium">
                  {formatStorageUsed(group.storageUsed)} /{" "}
                  {formatStorageUsed(group.storageLimit)}
                </span>
                <span className="text-gray-500">
                  ({Math.round((group.storageUsed / group.storageLimit) * 100)}
                  %)
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {media.length === 0 && !mediaLoading && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="max-w-md w-full">
              <CardContent className="pt-12 pb-12 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Upload className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  No Photos Yet
                </h2>
                <p className="text-gray-600 mb-2">
                  Upload your first photos to get started!
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  AI will automatically detect and group faces
                </p>
                <Button onClick={() => setShowUploadDialog(true)} size="lg">
                  <Upload className="h-5 w-5 mr-2" />
                  Upload Photos
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {isProcessing && media.length > 0 && (
          <FaceGroupingSkeleton photoCount={media.length} />
        )}

        {!isProcessing && clusters.length > 0 && media.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Filter by Person</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUploadDialog(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Add Photos
              </Button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {/* All Photos */}
              <button
                onClick={() => setSelectedClusterId(null)}
                className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  selectedClusterId === null
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Image className="h-8 w-8 text-white" />
                </div>
                <span className="text-sm font-medium">All Photos</span>
                <span className="text-xs text-gray-500">{totalMediaCount}</span>
              </button>

              {/* No Person / Ungrouped Photos */}
              {clusters.length > 0 && (
                <button
                  onClick={() => setSelectedClusterId("ungrouped")}
                  className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    selectedClusterId === "ungrouped"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  disabled={filterLoading}
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center">
                    <UserX className="h-8 w-8 text-white" />
                  </div>
                  <span className="text-sm font-medium">No Person</span>
                  <span className="text-xs text-gray-500">
                    {filterLoading
                      ? "..."
                      : selectedClusterId === "ungrouped"
                      ? filteredMedia.length
                      : "..."}
                  </span>
                </button>
              )}

              {/* Clusters */}
              {clusters.map((cluster) => (
                <div
                  key={cluster.id}
                  className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                    selectedClusterId === cluster.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedClusterId(cluster.id)}
                >
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200">
                    {cluster.samplePhoto?.thumbnailUrl ? (
                      <img
                        src={cluster.samplePhoto.thumbnailUrl}
                        alt={cluster.clusterName || "Person"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-center max-w-[80px] truncate">
                      {cluster.clusterName || "Unknown"}
                    </span>
                    {user && group && group.creatorId === user.id && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditCluster(cluster);
                          }}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                          title="Rename person"
                        >
                          <Pencil className="h-3 w-3 text-gray-500" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClusterClick(cluster, e)}
                          className="p-1 hover:bg-red-100 rounded transition-colors"
                          title="Delete person and all photos"
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </button>
                      </>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {cluster.appearanceCount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading state for filter */}
        {filterLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-600">Loading ungrouped photos...</p>
          </div>
        )}

        {/* Empty state when filter finds no photos */}
        {!filterLoading &&
          selectedClusterId === "ungrouped" &&
          filteredMedia.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <UserX className="h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No Ungrouped Photos
              </h3>
              <p className="text-sm text-gray-500">
                All photos have been grouped with people.
              </p>
            </div>
          )}

        {/* Media Grid */}
        {!filterLoading && filteredMedia.length > 0 && (
          <>
            {/* Selection and Download Controls */}
            <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                  {selectedMedia.length === filteredMedia.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
                {selectedMedia.length > 0 && (
                  <span className="text-sm text-gray-600">
                    {selectedMedia.length} selected
                  </span>
                )}
              </div>

              {/* Download Buttons */}
              <div className="flex items-center gap-2">
                {selectedMedia.length > 0 && (
                  <Button
                    onClick={handleBulkDownload}
                    className="gap-2"
                    size="sm"
                  >
                    <Download className="h-4 w-4" />
                    Download Selected ({selectedMedia.length})
                  </Button>
                )}
                {selectedMedia.length === 0 && filteredMedia.length > 0 && (
                  <Button
                    onClick={handleBulkDownload}
                    variant="outline"
                    className="gap-2"
                    size="sm"
                  >
                    <Download className="h-4 w-4" />
                    Download All ({filteredMedia.length})
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredMedia.map((item) => (
                <Card
                  key={item.id}
                  className={`overflow-hidden cursor-pointer transition-all ${
                    selectedMedia.includes(item.id)
                      ? "ring-2 ring-blue-500"
                      : "hover:shadow-lg"
                  }`}
                  onClick={() => toggleMediaSelection(item.id)}
                >
                  <div className="aspect-square relative bg-gray-100 group">
                    <img
                      src={item.presignedUrl}
                      alt={item.originalName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />

                    {/* Face bounding boxes - only show when viewing a specific cluster */}
                    {selectedClusterId &&
                      selectedClusterId !== "ungrouped" &&
                      "faceDetections" in item &&
                      item.faceDetections?.map((face: FaceDetection) => (
                        <div
                          key={face.id}
                          className="absolute border-2 border-green-400 group-hover:border-green-500"
                          style={{
                            left: `${face.boundingBox.x * 100}%`,
                            top: `${face.boundingBox.y * 100}%`,
                            width: `${face.boundingBox.width * 100}%`,
                            height: `${face.boundingBox.height * 100}%`,
                          }}
                        >
                          {/* Remove face button - only for admin */}
                          {user && group && group.creatorId === user.id && (
                            <button
                              onClick={(e) =>
                                handleRemoveFaceFromCluster(face.id, e)
                              }
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
                              title="Remove this face from cluster"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}

                    {/* Selection indicator */}
                    {selectedMedia.includes(item.id) && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-2">
                        <div className="h-4 w-4 flex items-center justify-center">
                          ✓
                        </div>
                      </div>
                    )}

                    {/* Download single photo button */}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await mediaApi.bulkDownload(groupId, [item.id]);
                        } catch (error) {
                          console.error("Download failed:", error);
                          alert("Failed to download photo");
                        }
                      }}
                      className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-green-600"
                      title="Download this photo"
                    >
                      <Download className="h-4 w-4" />
                    </button>

                    {/* Delete button - only show if user can delete this media */}
                    {canDeleteMedia(item) && (
                      <button
                        onClick={(e) => handleDeleteClick(item, e)}
                        className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        title="Delete photo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <p className="text-sm font-medium truncate">
                      {item.originalName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(item.fileSize / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Load More Button - only show when viewing all photos (not filtered) */}
            {selectedClusterId === null &&
              hasMoreMedia &&
              filteredMedia.length > 0 && (
                <div className="flex justify-center mt-8">
                  <Button
                    onClick={loadMoreMedia}
                    disabled={loadingMore}
                    variant="outline"
                    className="gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900" />
                        Loading more...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Load More Photos
                      </>
                    )}
                  </Button>
                </div>
              )}
          </>
        )}
      </main>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogTitle>Upload Photos</DialogTitle>
          <div className="space-y-4">
            <div>
              <Label
                htmlFor="file-upload"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Select Photos
              </Label>
              <input
                id="file-upload"
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileUpload(e.target.files);
                  }
                }}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
                disabled={uploadingFiles}
              />
            </div>
            {uploadingFiles && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                Uploading...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent>
          <DialogTitle>Group Members</DialogTitle>
          <div className="space-y-3">
            {group.members.map((member) => (
              <div
                key={member.userId.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">{member.userId.name}</p>
                  <p className="text-sm text-gray-500">{member.userId.email}</p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    member.userId.id === group.creatorId
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {member.userId.id === group.creatorId ? "Admin" : "Viewer"}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Cluster Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Rename Person</DialogTitle>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cluster-name">Name</Label>
              <Input
                id="cluster-name"
                type="text"
                value={editingClusterName}
                onChange={(e) => setEditingClusterName(e.target.value)}
                placeholder="Enter name..."
                maxLength={50}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveClusterName();
                  }
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveClusterName} className="flex-1">
                Save
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelEditCluster}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Photo Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete Photo</DialogTitle>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-700">
                  Are you sure you want to delete{" "}
                  <strong>{mediaToDelete?.originalName}</strong>?
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDeleteCancel}
                className="flex-1"
                disabled={deletingMedia}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={deletingMedia}
              >
                {deletingMedia ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Cluster Confirmation Dialog */}
      <Dialog
        open={showDeleteClusterDialog}
        onOpenChange={setShowDeleteClusterDialog}
      >
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete Person</DialogTitle>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-700">
                  Are you sure you want to delete{" "}
                  <strong>{clusterToDelete?.clusterName || "Unknown"}</strong>?
                </p>
                <p className="text-xs text-red-600 font-semibold mt-2">
                  This will delete ALL {clusterToDelete?.appearanceCount}{" "}
                  photo(s) containing this person.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDeleteClusterCancel}
                className="flex-1"
                disabled={deletingCluster}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteClusterConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={deletingCluster}
              >
                {deletingCluster ? "Deleting..." : "Delete All"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {group && (
        <>
          <GroupSettingsModal
            group={group}
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            onUpdate={loadGroup}
          />

          <InvitePeopleDialog
            isOpen={showInviteDialog}
            onClose={() => setShowInviteDialog(false)}
            groupId={groupId}
            groupName={group.name}
            inviteCode={group.inviteCode}
          />
        </>
      )}
    </div>
  );
}
