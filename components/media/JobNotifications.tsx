"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface JobNotificationsProps {
  groupId: string;
}

interface JobUpdate {
  jobId: string;
  jobType: string;
  status: string;
  progress: number;
  metadata?: Record<string, unknown>;
}

export function JobNotifications({ groupId }: JobNotificationsProps) {
  const [lastProcessedJobs, setLastProcessedJobs] = useState<Set<string>>(
    new Set()
  );
  const { toast } = useToast();

  useEffect(() => {
    const checkJobUpdates = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/groups/${groupId}/jobs`);
        const result = await response.json();

        if (result.success) {
          const jobs: JobUpdate[] = result.data;

          jobs.forEach((job) => {
            if (
              job.status === "COMPLETED" &&
              !lastProcessedJobs.has(job.jobId)
            ) {
              // Show completion notification
              const facesDetected =
                job.metadata && "facesDetected" in job.metadata
                  ? (job.metadata.facesDetected as number)
                  : 0;

              const clustersCreated =
                job.metadata && "clustersCreated" in job.metadata
                  ? (job.metadata.clustersCreated as number)
                  : 0;

              let description = "";
              if (job.jobType === "FACE_DETECTION") {
                description = `Detected ${facesDetected} faces in your photos`;
              } else if (job.jobType === "FACE_GROUPING") {
                description = `Found ${clustersCreated} people in your photos`;
              }

              toast({
                title: "Processing Complete",
                description,
                duration: 5000,
              });

              setLastProcessedJobs((prev) => new Set(prev).add(job.jobId));
            } else if (
              job.status === "FAILED" &&
              !lastProcessedJobs.has(job.jobId)
            ) {
              // Show failure notification
              toast({
                title: "Processing Failed",
                description: `${getJobTitle(job.jobType)} encountered an error`,
                variant: "destructive",
                duration: 8000,
              });

              setLastProcessedJobs((prev) => new Set(prev).add(job.jobId));
            }
          });
        }
      } catch (error) {
        console.error("Failed to check job updates:", error);
      }
    };

    // Check for updates every 5 seconds
    const interval = setInterval(checkJobUpdates, 5000);

    // Initial check
    checkJobUpdates();

    return () => clearInterval(interval);
  }, [groupId, toast, lastProcessedJobs]);

  const getJobTitle = (jobType: string): string => {
    switch (jobType) {
      case "FACE_DETECTION":
        return "Face Detection";
      case "FACE_GROUPING":
        return "Face Grouping";
      case "MEDIA_CLEANUP":
        return "Media Cleanup";
      default:
        return "Processing";
    }
  };

  return null; // This component only handles notifications, no UI
}
