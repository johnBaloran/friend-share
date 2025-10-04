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
import type { JobType, JobStatus as JobStatusType } from "@/lib/types";

interface JobProgressTrackerProps {
  groupId: string;
  onJobComplete?: () => void;
}

// API response type with string dates
interface ApiJobStatus {
  _id: string;
  jobId: string;
  jobType: JobType;
  groupId?: string;
  status: JobStatusType;
  progress: number;
  totalItems?: number;
  processedItems: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function JobProgressTracker({
  groupId,
  onJobComplete,
}: JobProgressTrackerProps) {
  const [jobs, setJobs] = useState<ApiJobStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async (): Promise<void> => {
    try {
      const response = await fetch(`/api/groups/${groupId}/jobs`);
      const result = await response.json();

      if (result.success) {
        setJobs(result.data);

        // Check if any jobs completed and trigger callback
        const completedJobs = result.data.filter(
          (job: ApiJobStatus) => job.status === "COMPLETED"
        );

        if (completedJobs.length > 0 && onJobComplete) {
          onJobComplete();
        }
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
        (job) => job.status === "PENDING" || job.status === "PROCESSING"
      );

      if (hasActiveJobs) {
        fetchJobs();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [groupId, jobs]);

  const cancelJob = async (jobId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        await fetchJobs(); // Refresh jobs list
      }
    } catch (error) {
      console.error("Failed to cancel job:", error);
    }
  };

  const getJobIcon = (jobType: string, status: string) => {
    if (status === "COMPLETED")
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === "FAILED")
      return <XCircle className="h-4 w-4 text-red-500" />;
    if (status === "CANCELLED")
      return <XCircle className="h-4 w-4 text-gray-500" />;
    if (status === "PROCESSING")
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

  // Filter out old completed jobs (keep only recent ones)
  const recentJobs = jobs.filter((job) => {
    if (job.status === "PENDING" || job.status === "PROCESSING") return true;

    const jobDate = new Date(job.updatedAt);
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
            key={job._id}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
          >
            <div className="flex-shrink-0">
              {getJobIcon(job.jobType, job.status)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-900">
                  {getJobTitle(job.jobType)}
                </p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      job.status === "COMPLETED" ? "default" : "secondary"
                    }
                    className="text-xs"
                  >
                    {job.status.toLowerCase()}
                  </Badge>
                  {(job.status === "PENDING" ||
                    job.status === "PROCESSING") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => cancelJob(job.jobId)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {job.status === "PROCESSING" && (
                <div className="space-y-1">
                  <Progress value={job.progress} className="h-2" />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>
                      {job.processedItems || 0} / {job.totalItems || 0} items
                    </span>
                    <span>{job.progress}%</span>
                  </div>
                </div>
              )}

              {job.errorMessage && (
                <p className="text-xs text-red-600 mt-1">{job.errorMessage}</p>
              )}

              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-500">
                  {formatTimeAgo(job.updatedAt)}
                </span>

                {job.metadata && typeof job.metadata === "object" && (
                  <span className="text-xs text-gray-500">
                    {job.jobType === "FACE_DETECTION" &&
                      "facesDetected" in job.metadata &&
                      `${job.metadata.facesDetected} faces detected`}
                    {job.jobType === "FACE_GROUPING" &&
                      "clustersCreated" in job.metadata &&
                      `${job.metadata.clustersCreated} people found`}
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
