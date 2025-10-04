import { useState, useEffect, useCallback } from "react";
import type { IJobStatus } from "@/lib/types";

interface UseJobProgressOptions {
  groupId: string;
  pollInterval?: number;
  onJobComplete?: (job: IJobStatus) => void;
}

interface UseJobProgressReturn {
  jobs: IJobStatus[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  cancelJob: (jobId: string) => Promise<boolean>;
  activeJobsCount: number;
}

export function useJobProgress({
  groupId,
  pollInterval = 3000,
  onJobComplete,
}: UseJobProgressOptions): UseJobProgressReturn {
  const [jobs, setJobs] = useState<IJobStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const response = await fetch(`/api/groups/${groupId}/jobs`);
      const result = await response.json();

      if (result.success) {
        const newJobs = result.data;

        // Check for newly completed jobs
        if (onJobComplete && jobs.length > 0) {
          newJobs.forEach((newJob: IJobStatus) => {
            const oldJob = jobs.find((j) => j.jobId === newJob.jobId);
            if (
              oldJob &&
              oldJob.status !== "COMPLETED" &&
              newJob.status === "COMPLETED"
            ) {
              onJobComplete(newJob);
            }
          });
        }

        setJobs(newJobs);
      } else {
        setError(result.error || "Failed to fetch jobs");
      }
    } catch (fetchError) {
      console.error("Failed to fetch jobs:", fetchError);
      setError("Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  }, [groupId, jobs, onJobComplete]);

  const cancelJob = useCallback(
    async (jobId: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`, {
          method: "DELETE",
        });

        const result = await response.json();

        if (result.success) {
          await fetchJobs(); // Refresh jobs list
          return true;
        } else {
          setError(result.error || "Failed to cancel job");
          return false;
        }
      } catch (cancelError) {
        console.error("Failed to cancel job:", cancelError);
        setError("Failed to cancel job");
        return false;
      }
    },
    [fetchJobs]
  );

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    // Only poll if there are active jobs
    const hasActiveJobs = jobs.some(
      (job) => job.status === "PENDING" || job.status === "PROCESSING"
    );

    if (!hasActiveJobs || loading) {
      return;
    }

    const interval = setInterval(fetchJobs, pollInterval);
    return () => clearInterval(interval);
  }, [jobs, loading, pollInterval, fetchJobs]);

  const activeJobsCount = jobs.filter(
    (job) => job.status === "PENDING" || job.status === "PROCESSING"
  ).length;

  return {
    jobs,
    loading,
    error,
    refetch: fetchJobs,
    cancelJob,
    activeJobsCount,
  };
}
