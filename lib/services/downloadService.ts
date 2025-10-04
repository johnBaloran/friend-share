import archiver from "archiver";
import fetch from "node-fetch";

export interface DownloadItem {
  filename: string;
  url: string;
  clusterId?: string;
  clusterName?: string;
}

export class DownloadService {
  static async createZipStream(items: DownloadItem[]): Promise<{
    stream: archiver.Archiver;
    promise: Promise<Buffer>;
  }> {
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    const chunks: Buffer[] = [];
    const zipPromise = new Promise<Buffer>((resolve, reject) => {
      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      archive.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", reject);
    });

    // Group items by cluster if clustering info is available
    const clusteredItems = this.groupItemsByCluster(items);

    for (const [clusterName, clusterItems] of clusteredItems.entries()) {
      for (let i = 0; i < clusterItems.length; i++) {
        const item = clusterItems[i];

        try {
          const response = await fetch(item.url);
          if (!response.ok) {
            console.warn(
              `Failed to fetch ${item.filename}: ${response.statusText}`
            );
            continue;
          }

          const buffer = await response.buffer();
          const fileExtension = this.getFileExtension(item.url);

          // Create organized folder structure
          let filePath: string;
          if (clusterName && clusterName !== "uncategorized") {
            // If multiple items in cluster, add index to prevent conflicts
            const fileName =
              clusterItems.length > 1
                ? `${this.sanitizeFilename(item.filename)}_${
                    i + 1
                  }${fileExtension}`
                : `${this.sanitizeFilename(item.filename)}${fileExtension}`;
            filePath = `${this.sanitizeFilename(clusterName)}/${fileName}`;
          } else {
            filePath = `${this.sanitizeFilename(
              item.filename
            )}${fileExtension}`;
          }

          archive.append(buffer, { name: filePath });
        } catch (error) {
          console.error(`Error downloading ${item.filename}:`, error);
        }
      }
    }

    archive.finalize();

    return {
      stream: archive,
      promise: zipPromise,
    };
  }

  private static groupItemsByCluster(
    items: DownloadItem[]
  ): Map<string, DownloadItem[]> {
    const groups = new Map<string, DownloadItem[]>();

    items.forEach((item) => {
      const clusterName = item.clusterName || "uncategorized";
      if (!groups.has(clusterName)) {
        groups.set(clusterName, []);
      }
      groups.get(clusterName)!.push(item);
    });

    return groups;
  }

  private static getFileExtension(url: string): string {
    const match = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    return match ? `.${match[1].toLowerCase()}` : ".jpg";
  }

  private static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, "_")
      .substring(0, 100); // Limit length
  }
}
