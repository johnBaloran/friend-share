// "use client";

// import { useState, useCallback, useRef } from "react";
// import { Button } from "@/components/ui/button";
// import { Progress } from "@/components/ui/progress";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { useToast } from "@/hooks/use-toast";
// import { Upload, X, Image, AlertCircle } from "lucide-react";

// interface FileWithPreview extends File {
//   preview?: string;
// }

// interface FileUploaderProps {
//   groupId: string;
//   onUploadComplete: () => void;
// }

// export function FileUploader({ groupId, onUploadComplete }: FileUploaderProps) {
//   const [files, setFiles] = useState<FileWithPreview[]>([]);
//   const [uploading, setUploading] = useState(false);
//   const [progress, setProgress] = useState(0);
//   const fileInputRef = useRef<HTMLInputElement>(null);
//   const { toast } = useToast();

//   const handleFileSelect = useCallback(
//     (selectedFiles: FileList | null) => {
//       if (!selectedFiles) return;

//       const fileArray = Array.from(selectedFiles);
//       const imageFiles = fileArray.filter((file) =>
//         file.type.startsWith("image/")
//       );

//       if (imageFiles.length !== fileArray.length) {
//         toast({
//           title: "Warning",
//           description: "Only image files are allowed",
//           variant: "destructive",
//         });
//       }

//       // Create preview URLs
//       const filesWithPreview = imageFiles.map((file) => {
//         const fileWithPreview = file as FileWithPreview;
//         fileWithPreview.preview = URL.createObjectURL(file);
//         return fileWithPreview;
//       });

//       setFiles((prev) => [...prev, ...filesWithPreview]);
//     },
//     [toast]
//   );

//   const handleDrop = useCallback(
//     (e: React.DragEvent) => {
//       e.preventDefault();
//       handleFileSelect(e.dataTransfer.files);
//     },
//     [handleFileSelect]
//   );

//   const handleDragOver = useCallback((e: React.DragEvent) => {
//     e.preventDefault();
//   }, []);

//   const removeFile = useCallback((index: number) => {
//     setFiles((prev) => {
//       const newFiles = prev.filter((_, i) => i !== index);
//       // Revoke preview URL to prevent memory leaks
//       if (prev[index].preview) {
//         URL.revokeObjectURL(prev[index].preview!);
//       }
//       return newFiles;
//     });
//   }, []);

//   const handleUpload = async () => {
//     if (files.length === 0) return;

//     setUploading(true);
//     setProgress(0);

//     try {
//       const formData = new FormData();
//       files.forEach((file) => formData.append("files", file));

//       // Simulate progress
//       const progressInterval = setInterval(() => {
//         setProgress((prev) => Math.min(prev + 10, 90));
//       }, 200);

//       const response = await fetch(`/api/groups/${groupId}/upload`, {
//         method: "POST",
//         body: formData,
//       });

//       clearInterval(progressInterval);

//       const result = await response.json();

//       if (!result.success) {
//         throw new Error(result.error);
//       }

//       setProgress(100);

//       toast({
//         title: "Success",
//         description: `Uploaded ${result.data.uploaded} files successfully`,
//       });

//       // Clean up
//       files.forEach((file) => {
//         if (file.preview) {
//           URL.revokeObjectURL(file.preview);
//         }
//       });

//       setFiles([]);
//       setProgress(0);
//       onUploadComplete();
//     } catch (error) {
//       toast({
//         title: "Error",
//         description: error instanceof Error ? error.message : "Upload failed",
//         variant: "destructive",
//       });
//     } finally {
//       setUploading(false);
//     }
//   };

//   const formatFileSize = (bytes: number) => {
//     if (bytes === 0) return "0 Bytes";
//     const k = 1024;
//     const sizes = ["Bytes", "KB", "MB", "GB"];
//     const i = Math.floor(Math.log(bytes) / Math.log(k));
//     return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
//   };

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle className="flex items-center gap-2">
//           <Upload className="h-5 w-5" />
//           Upload Photos
//         </CardTitle>
//       </CardHeader>
//       <CardContent className="space-y-4">
//         {/* Drop Zone */}
//         <div
//           className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
//           onDrop={handleDrop}
//           onDragOver={handleDragOver}
//           onClick={() => fileInputRef.current?.click()}
//         >
//           <div className="flex flex-col items-center gap-4">
//             <Image className="h-12 w-12 text-gray-400" />
//             <div>
//               <p className="text-lg font-medium">
//                 Drop photos here or click to select
//               </p>
//               <p className="text-sm text-gray-500 mt-1">
//                 Supports JPG, PNG, WebP (Max 10MB per file)
//               </p>
//             </div>
//           </div>
//         </div>

//         <input
//           ref={fileInputRef}
//           type="file"
//           multiple
//           accept="image/*"
//           className="hidden"
//           onChange={(e) => handleFileSelect(e.target.files)}
//         />

//         {/* File List */}
//         {files.length > 0 && (
//           <div className="space-y-2">
//             <h4 className="font-medium">Selected Files ({files.length})</h4>
//             <div className="max-h-40 overflow-y-auto space-y-2">
//               {files.map((file, index) => (
//                 <div
//                   key={index}
//                   className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
//                 >
//                   {file.preview && (
//                     <img
//                       src={file.preview}
//                       alt="Preview"
//                       className="w-10 h-10 object-cover rounded"
//                     />
//                   )}
//                   <div className="flex-1 min-w-0">
//                     <p className="text-sm font-medium truncate">{file.name}</p>
//                     <p className="text-xs text-gray-500">
//                       {formatFileSize(file.size)}
//                     </p>
//                   </div>
//                   <Button
//                     variant="ghost"
//                     size="sm"
//                     onClick={() => removeFile(index)}
//                     className="text-red-500 hover:text-red-700"
//                   >
//                     <X className="h-4 w-4" />
//                   </Button>
//                 </div>
//               ))}
//             </div>
//           </div>
//         )}

//         {/* Upload Progress */}
//         {uploading && (
//           <div className="space-y-2">
//             <div className="flex items-center justify-between text-sm">
//               <span>Uploading...</span>
//               <span>{progress}%</span>
//             </div>
//             <Progress value={progress} className="h-2" />
//           </div>
//         )}

//         {/* Upload Button */}
//         <Button
//           onClick={handleUpload}
//           disabled={files.length === 0 || uploading}
//           className="w-full"
//         >
//           {uploading
//             ? "Uploading..."
//             : `Upload ${files.length} Photo${files.length !== 1 ? "s" : ""}`}
//         </Button>

//         {/* Info */}
//         <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
//           <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
//           <p className="text-xs text-blue-700">
//             Photos will be automatically processed for face detection after
//             upload. You will be able to organize them by people once processing
//             is complete.
//           </p>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }

"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, CheckCircle } from "lucide-react";

interface FileUploaderProps {
  groupId: string;
  onUploadComplete: () => void;
}

interface UploadState {
  uploading: boolean;
  processing: boolean;
  progress: number;
  currentStep: "uploading" | "processing" | "complete";
  results?: {
    uploadedCount: number;
    facesDetected: number;
    clustersCreated: number;
  };
}

export function FileUploader({ groupId, onUploadComplete }: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>({
    uploading: false,
    processing: false,
    progress: 0,
    currentStep: "uploading",
  });
  const { toast } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const validFiles = acceptedFiles.filter((file) => {
        const isImage = file.type.startsWith("image/");
        const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB

        if (!isImage) {
          toast({
            title: "Invalid file type",
            description: `${file.name} is not an image file`,
            variant: "destructive",
          });
          return false;
        }

        if (!isValidSize) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds 10MB limit`,
            variant: "destructive",
          });
          return false;
        }

        return true;
      });

      setFiles((prev) => [...prev, ...validFiles]);
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp"],
    },
    multiple: true,
  });

  const removeFile = (index: number): void => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (): Promise<void> => {
    if (files.length === 0) return;
    const estimatedTime = files.length * 4; // 4 seconds per image for face processing

    setUploadState({
      uploading: true,
      processing: false,
      progress: 0,
      currentStep: "uploading",
    });

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadState((prev) => ({
          ...prev,
          progress: Math.min(prev.progress + 100 / estimatedTime, 95), // Don't reach 100% until complete
        }));
      }, 1000);

      const response = await fetch(`/api/groups/${groupId}/upload`, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      const result = await response.json();

      if (result.success) {
        setUploadState({
          uploading: false,
          processing: false,
          progress: 100,
          currentStep: "complete",
          results: {
            uploadedCount: result.data.uploadedCount,
            facesDetected: result.data.facesDetected,
            clustersCreated: result.data.clustersCreated,
          },
        });

        toast({
          title: "Upload successful",
          description: `Uploaded ${result.data.uploadedCount} files${
            result.data.facesDetected > 0
              ? `, detected ${result.data.facesDetected} faces`
              : ""
          }`,
        });

        setFiles([]);
        onUploadComplete();

        // Reset state after 3 seconds
        setTimeout(() => {
          setUploadState({
            uploading: false,
            processing: false,
            progress: 0,
            currentStep: "uploading",
          });
        }, 3000);
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Upload failed:", error);

      setUploadState({
        uploading: false,
        processing: false,
        progress: 0,
        currentStep: "uploading",
      });

      toast({
        title: "Upload failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const isProcessing = uploadState.uploading;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Photos
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          } ${isProcessing ? "pointer-events-none opacity-50" : ""}`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          {isDragActive ? (
            <p>Drop the images here...</p>
          ) : (
            <div>
              <p className="text-lg mb-2">
                Drop images here or click to browse
              </p>
              <p className="text-sm text-gray-500">
                Supports JPEG, PNG, GIF, WebP up to 10MB each
              </p>
            </div>
          )}
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Selected Files ({files.length})</h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 p-2 rounded"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  {!isProcessing && (
                    <Button
                      onClick={() => removeFile(index)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress indicator */}
        {isProcessing && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {uploadState.currentStep === "uploading" && (
                <>
                  <Upload className="h-4 w-4 text-blue-500 animate-pulse" />
                  <span className="text-sm">
                    Uploading files and processing faces...
                  </span>
                </>
              )}
            </div>

            <Progress value={uploadState.progress} className="h-2" />

            <p className="text-xs text-gray-500 text-center">
              This may take 10-30 seconds depending on the number of photos and
              faces detected
            </p>
          </div>
        )}

        {/* Results */}
        {uploadState.currentStep === "complete" && uploadState.results && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="font-medium text-green-900">
                Upload Complete!
              </span>
            </div>
            <div className="space-y-1 text-sm text-green-800">
              <p>📁 {uploadState.results.uploadedCount} files uploaded</p>
              {uploadState.results.facesDetected > 0 && (
                <>
                  <p>👤 {uploadState.results.facesDetected} faces detected</p>
                  <p>
                    👥 {uploadState.results.clustersCreated} people identified
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Upload button */}
        <Button
          onClick={uploadFiles}
          disabled={files.length === 0 || isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Upload className="h-4 w-4 mr-2 animate-pulse" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload {files.length} file{files.length !== 1 ? "s" : ""}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
