"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  X,
  Users,
} from "lucide-react";
import { jobsApi, JobStatus } from "@/lib/api/jobs";

interface JobProgressTrackerProps {
  groupId: string;
  onJobComplete?: () => void;
}

export function JobProgressTracker({
  groupId,
  onJobComplete,
}: JobProgressTrackerProps) {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async (): Promise<void> => {
    try {
      const data = await jobsApi.listByGroup(groupId);
      setJobs(data);

      // Check if any jobs completed and trigger callback
      const completedJobs = data.filter(
        (job) => job.status === "completed" || job.status === "COMPLETED"
      );

      if (completedJobs.length > 0 && onJobComplete) {
        onJobComplete();
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();

    // Poll for updates every 3 seconds for active jobs
    const interval = setInterval(() => {
      const hasActiveJobs = jobs.some(
        (job) =>
          job.status === "pending" ||
          job.status === "PENDING" ||
          job.status === "processing" ||
          job.status === "PROCESSING"
      );

      if (hasActiveJobs) {
        fetchJobs();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [groupId, jobs]);

  const cancelJob = async (jobId: string): Promise<void> => {
    try {
      await jobsApi.cancel(jobId);
      await fetchJobs(); // Refresh jobs list
    } catch (error) {
      console.error("Failed to cancel job:", error);
    }
  };

  const getJobIcon = (jobType: string, status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === "completed")
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (statusLower === "failed")
      return <XCircle className="h-4 w-4 text-red-500" />;
    if (statusLower === "cancelled")
      return <XCircle className="h-4 w-4 text-gray-500" />;
    if (statusLower === "processing")
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;

    // Default pending state
    if (jobType === "FACE_DETECTION")
      return <Brain className="h-4 w-4 text-gray-400" />;
    if (jobType === "FACE_GROUPING")
      return <Users className="h-4 w-4 text-gray-400" />;
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  const getJobTitle = (jobType: string): string => {
    switch (jobType) {
      case "FACE_DETECTION":
        return "Face Detection";
      case "FACE_GROUPING":
        return "Face Grouping";
      case "MEDIA_CLEANUP":
        return "Media Cleanup";
      default:
        return "Unknown Job";
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getJobResultMessage = (job: JobStatus): string | null => {
    if (!job.result || typeof job.result !== "object") {
      return null;
    }

    if (job.jobType === "FACE_DETECTION" && "facesDetected" in job.result) {
      const result = job.result as { facesDetected: number };
      return `${result.facesDetected} faces detected`;
    }

    if (job.jobType === "FACE_GROUPING" && "clustersCreated" in job.result) {
      const result = job.result as { clustersCreated: number };
      return `${result.clustersCreated} people found`;
    }

    return null;
  };

  // Filter out old completed jobs (keep only recent ones)
  const recentJobs = jobs.filter((job) => {
    const statusLower = job.status.toLowerCase();
    if (statusLower === "pending" || statusLower === "processing") return true;

    if (!job.finishedOn && !job.createdAt) return true;

    const jobDate = new Date(job.finishedOn || job.createdAt || Date.now());
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return jobDate > oneDayAgo;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (recentJobs.length === 0) {
    return null; // Don't show the component if no recent jobs
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Processing Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentJobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
          >
            <div className="flex-shrink-0">
              {getJobIcon(job.jobType || "", job.status)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-900">
                  {getJobTitle(job.jobType || "")}
                </p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      job.status === "completed" || job.status === "COMPLETED"
                        ? "default"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {job.status.toLowerCase()}
                  </Badge>
                  {(job.status === "pending" ||
                    job.status === "PENDING" ||
                    job.status === "processing" ||
                    job.status === "PROCESSING") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => cancelJob(job.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {(job.status === "processing" || job.status === "PROCESSING") && (
                <div className="space-y-1">
                  <Progress value={job.progress || 0} className="h-2" />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{job.progress || 0}%</span>
                  </div>
                </div>
              )}

              {job.error && (
                <p className="text-xs text-red-600 mt-1">{job.error}</p>
              )}

              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-500">
                  {job.createdAt &&
                    formatTimeAgo(
                      typeof job.createdAt === "string"
                        ? job.createdAt
                        : job.createdAt.toISOString()
                    )}
                </span>

                {getJobResultMessage(job) && (
                  <span className="text-xs text-gray-500">
                    {getJobResultMessage(job)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
