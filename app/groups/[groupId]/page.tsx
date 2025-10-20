"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Header } from "@/components/layout/Header";
import { FileUploader } from "@/components/media/FileUploader";
import { MediaGallery } from "@/components/media/MediaGallery";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Users } from "lucide-react";
import Link from "next/link";
// import { JobProgressTracker } from "@/components/media/JobProgressTracker";
import { FaceClusterGrid } from "@/components/media/FaceClusterGrid";
import { PersonMediaGallery } from "@/components/media/PersonMediaGallery";

// import { JobNotifications } from "@/components/media/JobNotifications";
import { ClusterStats } from "@/components/media/ClusterStats";
import { MediaFilters } from "@/components/media/MediaFilters";

interface Group {
  _id: string;
  name: string;
  description?: string;
  members: Array<{
    userId: {
      name?: string;
      email: string;
    };
    role: string;
  }>;
  storageUsed: number;
  storageLimit: number;
}

interface MediaItem {
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
}

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

// Add these interfaces at the top
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
  faceDetections: Array<{
    _id: string;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    confidence: number;
  }>;
}

interface ClusterInfo {
  _id: string;
  clusterName?: string;
  appearanceCount: number;
}

export default function GroupDetailPage() {
  const params = useParams();
  const { user } = useUser();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [clusters, setClusters] = useState<FaceCluster[]>([]);
  const [clustersLoading, setClustersLoading] = useState(false);

  // Add these new state variables after the existing ones
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [clusterMedia, setClusterMedia] = useState<MediaWithFaces[]>([]);
  const [clusterMediaLoading, setClusterMediaLoading] = useState(false);
  const [clusterInfo, setClusterInfo] = useState<ClusterInfo | null>(null);

  // Add this function to load cluster-specific media
  const loadClusterMedia = useCallback(
    async (clusterId: string): Promise<void> => {
      setClusterMediaLoading(true);
      try {
        const response = await fetch(`/api/clusters/${clusterId}/media`);
        const result = await response.json();

        if (result.success) {
          setClusterMedia(result.data.media || []);
          setClusterInfo(result.data.cluster);
        }
      } catch (error) {
        console.error("Failed to load cluster media:", error);
      } finally {
        setClusterMediaLoading(false);
      }
    },
    []
  );

  // Update the handleClusterSelect function
  const handleClusterSelect = (clusterId: string): void => {
    setSelectedCluster(clusterId);
    loadClusterMedia(clusterId);
  };

  // Add function to go back to main view
  const handleBackToMain = (): void => {
    setSelectedCluster(null);
    setClusterMedia([]);
    setClusterInfo(null);
  };

  // Add cluster loading function with useCallback to prevent dependency issues
  const loadClusters = useCallback(async (): Promise<void> => {
    setClustersLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/clusters`);
      const result = await response.json();

      if (result.success) {
        setClusters(result.data || []);
      }
    } catch (error) {
      console.error("Failed to load clusters:", error);
    } finally {
      setClustersLoading(false);
    }
  }, [groupId]);

  const loadGroup = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`/api/groups/${groupId}`);
      const result = await response.json();

      if (result.success) {
        setGroup(result.data);
      }
    } catch (error) {
      console.error("Failed to load group:", error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const loadMedia = useCallback(async (): Promise<void> => {
    setMediaLoading(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/media`);
      const result = await response.json();

      if (result.success) {
        setMedia(result.data.media || []);
      }
    } catch (error) {
      console.error("Failed to load media:", error);
    } finally {
      setMediaLoading(false);
    }
  }, [groupId]);

  const handleClusterUpdate = async (
    clusterId: string,
    updates: { clusterName?: string }
  ): Promise<void> => {
    try {
      const response = await fetch(`/api/clusters/${clusterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const result = await response.json();
      if (result.success) {
        await loadClusters(); // Refresh clusters
      }
    } catch (error) {
      console.error("Failed to update cluster:", error);
    }
  };

  const handleClusterDelete = async (clusterId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/clusters/${clusterId}`, {
        method: "DELETE",
      });

      const result = await response.json();
      if (result.success) {
        await loadClusters(); // Refresh clusters
      }
    } catch (error) {
      console.error("Failed to delete cluster:", error);
    }
  };

  useEffect(() => {
    if (user && groupId) {
      loadGroup();
      loadMedia();
      loadClusters();
    }
  }, [user, groupId, loadGroup, loadMedia, loadClusters]);

  const handleUploadComplete = (): void => {
    loadMedia();
    loadGroup(); // Refresh to update storage usage
  };

  const formatStorageUsed = (bytes: number): string => {
    return `${Math.round(bytes / 1024 / 1024)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Group Not Found
          </h2>
          <Link href="/dashboard">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Breadcrumb Navigation */}
        <div className="mb-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Group Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Group Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{group.name}</h1>
                  {group.description && (
                    <p className="text-gray-600 text-sm mt-0.5">{group.description}</p>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600">{group.members.length} Members</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">{media.length} Photos</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-gray-600">{clusters.length} People Detected</span>
                </div>
              </div>
            </div>

            {/* Storage & Actions */}
            <div className="flex flex-col lg:items-end gap-3">
              <Button variant="outline" size="sm" className="w-full lg:w-auto">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>

              {/* Storage Card */}
              <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg p-4 border border-gray-200 min-w-[200px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">Storage Used</span>
                  <span className="text-xs font-bold text-gray-900">
                    {Math.round((group.storageUsed / group.storageLimit) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        (group.storageUsed / group.storageLimit) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-600">
                  {formatStorageUsed(group.storageUsed)} of {formatStorageUsed(group.storageLimit)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Face Filter Bar - Full Width */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
          <FaceClusterGrid
            clusters={clusters}
            loading={clustersLoading}
            onClusterSelect={handleClusterSelect}
            onClusterUpdate={handleClusterUpdate}
            onClusterDelete={handleClusterDelete}
            canEdit={true}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-5">
            {/* Upload Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <FileUploader
                groupId={groupId}
                onUploadComplete={handleUploadComplete}
              />
            </div>

            {/* Stats Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <ClusterStats
                clusters={clusters}
                totalMedia={media.length}
                loading={clustersLoading}
                groupId={groupId}
                onReclusterComplete={() => {
                  loadClusters();
                  loadMedia();
                }}
              />
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <MediaFilters
                onFiltersChange={(filters) => {
                  console.log("Applying filters:", filters);
                  // TODO: Implement filtering logic
                }}
                totalMedia={media.length}
                filteredCount={media.length}
                clusters={clusters}
              />
            </div>

            {/* Members List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-900">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Users className="h-4 w-4 text-green-600" />
                </div>
                <span>Members</span>
                <span className="ml-auto text-xs font-normal bg-gray-100 px-2 py-1 rounded-full">
                  {group.members.length}
                </span>
              </h3>
              <div className="space-y-3">
                {group.members.map((member, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      {(member.userId.name || member.userId.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.userId.name || member.userId.email.split("@")[0]}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {member.userId.email}
                      </p>
                    </div>
                    <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full capitalize">
                      {member.role.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Media Gallery */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {selectedCluster && clusterInfo ? (
                <PersonMediaGallery
                  media={clusterMedia}
                  cluster={clusterInfo}
                  loading={clusterMediaLoading}
                  onBack={handleBackToMain}
                  onDownload={(mediaIds) => {
                    console.log("Download cluster media:", mediaIds);
                    // TODO: Implement download functionality
                  }}
                />
              ) : (
                <MediaGallery
                  media={media}
                  groupId={groupId}
                  loading={mediaLoading}
                  onDownload={(mediaIds) => {
                    console.log("Download functionality coming soon:", mediaIds);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* <JobNotifications groupId={groupId} /> */}
    </div>
  );
}
