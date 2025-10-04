import { v2 as cloudinary } from "cloudinary";
import { config } from "@/lib/config/env";

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}

export class CloudinaryService {
  static async uploadMedia(
    buffer: Buffer,
    filename: string,
    groupId: string
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "auto",
            folder: `groups/${groupId}`,
            public_id: `${Date.now()}_${filename}`,
            quality: "auto",
            fetch_format: "auto",
          },
          (error, result) => {
            if (error) reject(error);
            else if (result) resolve(result as CloudinaryUploadResult);
            else reject(new Error("Upload failed"));
          }
        )
        .end(buffer);
    });
  }

  static async deleteMedia(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  static async bulkDelete(publicIds: string[]): Promise<void> {
    await cloudinary.api.delete_resources(publicIds);
  }
}
