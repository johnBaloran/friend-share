import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { mediaApi } from "@/lib/api/media";

interface UseDeleteOptions {
  onDeleteSuccess?: () => void;
}

interface UseDeleteReturn {
  deleting: boolean;
  deleteMedia: (mediaId: string) => Promise<boolean>;
  deleteMultiple: (mediaIds: string[]) => Promise<boolean>;
}

export function useDelete({
  onDeleteSuccess,
}: UseDeleteOptions = {}): UseDeleteReturn {
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const deleteMedia = async (mediaId: string): Promise<boolean> => {
    if (deleting) return false;

    setDeleting(true);

    try {
      await mediaApi.delete(mediaId);

      toast({
        title: "Photo Deleted",
        description: "The photo has been deleted successfully",
      });

      if (onDeleteSuccess) {
        onDeleteSuccess();
      }

      return true;
    } catch (error) {
      console.error("Delete failed:", error);
      toast({
        title: "Delete Failed",
        description:
          error instanceof Error ? error.message : "Failed to delete photo",
        variant: "destructive",
      });

      return false;
    } finally {
      setDeleting(false);
    }
  };

  const deleteMultiple = async (mediaIds: string[]): Promise<boolean> => {
    if (deleting || mediaIds.length === 0) return false;

    setDeleting(true);

    try {
      // Delete all media items in parallel
      await Promise.all(mediaIds.map((id) => mediaApi.delete(id)));

      toast({
        title: "Photos Deleted",
        description: `Successfully deleted ${mediaIds.length} photo${
          mediaIds.length > 1 ? "s" : ""
        }`,
      });

      if (onDeleteSuccess) {
        onDeleteSuccess();
      }

      return true;
    } catch (error) {
      console.error("Bulk delete failed:", error);
      toast({
        title: "Delete Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete some photos",
        variant: "destructive",
      });

      return false;
    } finally {
      setDeleting(false);
    }
  };

  return {
    deleting,
    deleteMedia,
    deleteMultiple,
  };
}
