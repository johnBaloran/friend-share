import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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

  const triggerDownload = async (
    downloadType: "selected" | "cluster" | "all",
    options: { mediaIds?: string[]; clusterId?: string } = {}
  ): Promise<void> => {
    if (downloading) return;

    setDownloading(true);

    try {
      const response = await fetch(`/api/groups/${groupId}/download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          downloadType,
          ...options,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Download failed");
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get("content-disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || "photos.zip";

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Complete",
        description: `Successfully downloaded ${filename}`,
      });
    } catch (error) {
      console.error("Download failed:", error);
      toast({
        title: "Download Failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const downloadSelected = async (mediaIds: string[]): Promise<void> => {
    await triggerDownload("selected", { mediaIds });
  };

  const downloadCluster = async (clusterId: string): Promise<void> => {
    await triggerDownload("cluster", { clusterId });
  };

  const downloadAll = async (): Promise<void> => {
    await triggerDownload("all");
  };

  return {
    downloading,
    downloadSelected,
    downloadCluster,
    downloadAll,
  };
}
