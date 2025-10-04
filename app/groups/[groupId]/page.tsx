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
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Group Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{group.name}</h1>
              {group.description && (
                <p className="text-gray-600 mt-1">{group.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <p className="text-gray-600">Storage</p>
              <p className="font-medium">
                {formatStorageUsed(group.storageUsed)} /{" "}
                {formatStorageUsed(group.storageLimit)}
              </p>
            </div>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Storage Usage Bar */}
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(
                  (group.storageUsed / group.storageLimit) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <FileUploader
              groupId={groupId}
              onUploadComplete={handleUploadComplete}
            />

            {/* <JobProgressTracker
              groupId={groupId}
              onJobComplete={() => {
                loadMedia();
                loadGroup();
                loadClusters();
              }}
            /> */}

            <ClusterStats
              clusters={clusters}
              totalMedia={media.length}
              loading={clustersLoading}
            />

            <MediaFilters
              onFiltersChange={(filters) => {
                console.log("Applying filters:", filters);
                // TODO: Implement filtering logic
              }}
              totalMedia={media.length}
              filteredCount={media.length}
              clusters={clusters}
            />

            <FaceClusterGrid
              clusters={clusters}
              loading={clustersLoading}
              onClusterSelect={handleClusterSelect}
              onClusterUpdate={handleClusterUpdate}
              onClusterDelete={handleClusterDelete}
              canEdit={true}
            />

            {/* Members List */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Members ({group.members.length})
              </h3>
              <div className="space-y-2">
                {group.members.map((member, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">
                      {member.userId.name || member.userId.email}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">
                      {member.role.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Media Gallery */}
          <div className="lg:col-span-3">
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
      </main>

      {/* <JobNotifications groupId={groupId} /> */}
    </div>
  );
}
