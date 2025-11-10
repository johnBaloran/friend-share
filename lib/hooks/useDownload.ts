import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { mediaApi } from "@/lib/api/media";

interface UseDownloadOptions {
  groupId: string;
}

interface UseDownloadReturn {
  downloading: boolean;
  downloadSelected: (mediaIds: string[]) => Promise<void>;
  downloadCluster: (clusterId: string) => Promise<void>;
  downloadAll: () => Promise<void>;
}

export function useDownload({
  groupId,
}: UseDownloadOptions): UseDownloadReturn {
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const downloadSelected = async (mediaIds: string[]): Promise<void> => {
    if (downloading || mediaIds.length === 0) return;

    setDownloading(true);

    try {
      await mediaApi.bulkDownload(groupId, mediaIds);

      toast({
        title: "Download Started",
        description: `Downloading ${mediaIds.length} ${mediaIds.length === 1 ? "photo" : "photos"}`,
      });
    } catch (error) {
      console.error("Download failed:", error);
      toast({
        title: "Download Failed",
        description:
          error instanceof Error ? error.message : "Failed to download photos",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const downloadCluster = async (clusterId: string): Promise<void> => {
    if (downloading) return;

    setDownloading(true);

    try {
      // TODO: Implement cluster download endpoint
      toast({
        title: "Coming Soon",
        description: "Cluster download will be available soon",
      });
    } catch (error) {
      console.error("Download failed:", error);
      toast({
        title: "Download Failed",
        description:
          error instanceof Error ? error.message : "Failed to download cluster photos",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const downloadAll = async (): Promise<void> => {
    if (downloading) return;

    setDownloading(true);

    try {
      // TODO: Implement download all endpoint
      toast({
        title: "Coming Soon",
        description: "Download all will be available soon",
      });
    } catch (error) {
      console.error("Download failed:", error);
      toast({
        title: "Download Failed",
        description:
          error instanceof Error ? error.message : "Failed to download all photos",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  return {
    downloading,
    downloadSelected,
    downloadCluster,
    downloadAll,
  };
}
