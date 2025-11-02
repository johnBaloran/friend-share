"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { jobsApi, JobStatus } from "@/lib/api/jobs";

interface JobNotificationsProps {
  groupId: string;
}

export function JobNotifications({ groupId }: JobNotificationsProps) {
  const [lastProcessedJobs, setLastProcessedJobs] = useState<Set<string>>(
    new Set()
  );
  const { toast } = useToast();

  useEffect(() => {
    const checkJobUpdates = async (): Promise<void> => {
      try {
        const jobs: JobStatus[] = await jobsApi.listByGroup(groupId);

        jobs.forEach((job) => {
          const statusLower = job.status.toLowerCase();
          if (
            statusLower === "completed" &&
            !lastProcessedJobs.has(job.id)
          ) {
            // Show completion notification
            const facesDetected =
              job.result && typeof job.result === 'object' && "facesDetected" in job.result
                ? (job.result.facesDetected as number)
                : 0;

            const clustersCreated =
              job.result && typeof job.result === 'object' && "clustersCreated" in job.result
                ? (job.result.clustersCreated as number)
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

            setLastProcessedJobs((prev) => new Set(prev).add(job.id));
          } else if (
            statusLower === "failed" &&
            !lastProcessedJobs.has(job.id)
          ) {
            // Show failure notification
            toast({
              title: "Processing Failed",
              description: `${getJobTitle(job.jobType || '')} encountered an error`,
              variant: "destructive",
              duration: 8000,
            });

            setLastProcessedJobs((prev) => new Set(prev).add(job.id));
          }
        });
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
