"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Activity as ActivityIcon,
  Upload,
  UserPlus,
  UserMinus,
  Tag,
  Download,
  Brain,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface ActivityFeedItem {
  _id: string;
  user: {
    _id: string;
    name?: string;
    email: string;
    avatar?: string;
  };
  type: string;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  timeAgo: string;
}

interface ActivityFeedProps {
  groupId: string;
  maxItems?: number;
  showHeader?: boolean;
}

export function ActivityFeed({
  groupId,
  maxItems = 20,
  showHeader = true,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const loadActivities = async (refresh: boolean = false): Promise<void> => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await fetch(
        `/api/groups/${groupId}/activities?limit=${maxItems}`
      );
      const result = await response.json();

      if (result.success) {
        setActivities(result.data.activities);
        setHasMore(result.data.hasMore);
      }
    } catch (error) {
      console.error("Failed to load activities:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [groupId, maxItems]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "UPLOAD":
        return <Upload className="h-4 w-4 text-blue-500" />;
      case "FACE_DETECTED":
        return <Brain className="h-4 w-4 text-purple-500" />;
      case "MEMBER_JOINED":
        return <UserPlus className="h-4 w-4 text-green-500" />;
      case "MEMBER_LEFT":
        return <UserMinus className="h-4 w-4 text-red-500" />;
      case "CLUSTER_NAMED":
        return <Tag className="h-4 w-4 text-orange-500" />;
      case "DOWNLOAD":
        return <Download className="h-4 w-4 text-indigo-500" />;
      default:
        return <ActivityIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityColor = (type: string): string => {
    switch (type) {
      case "UPLOAD":
        return "bg-blue-50 border-blue-200";
      case "FACE_DETECTED":
        return "bg-purple-50 border-purple-200";
      case "MEMBER_JOINED":
        return "bg-green-50 border-green-200";
      case "MEMBER_LEFT":
        return "bg-red-50 border-red-200";
      case "CLUSTER_NAMED":
        return "bg-orange-50 border-orange-200";
      case "DOWNLOAD":
        return "bg-indigo-50 border-indigo-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ActivityIcon className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadActivities(true)}
              disabled={refreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </CardHeader>
      )}

      <CardContent className={showHeader ? "" : "pt-6"}>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ActivityIcon className="mx-auto h-12 w-12 mb-2 text-gray-300" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div key={activity._id}>
                <div
                  className={`flex items-start gap-3 p-3 rounded-lg border ${getActivityColor(
                    activity.type
                  )}`}
                >
                  <div className="flex-shrink-0 mt-1">
                    {getActivityIcon(activity.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src={activity.user.avatar}
                          alt={activity.user.name}
                        />
                        <AvatarFallback className="text-xs">
                          {activity.user.name?.charAt(0) ||
                            activity.user.email.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-sm font-medium text-gray-900">
                        {activity.title}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {activity.timeAgo}
                      </Badge>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">
                      {activity.description}
                    </p>

                    {/* Metadata display */}
                    {activity.metadata &&
                      Object.keys(activity.metadata).length > 0 && (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {typeof activity.metadata.mediaCount === "number" && (
                            <Badge variant="secondary">
                              {activity.metadata.mediaCount} photos
                            </Badge>
                          )}
                          {typeof activity.metadata.facesDetected ===
                            "number" && (
                            <Badge variant="secondary">
                              {activity.metadata.facesDetected} faces
                            </Badge>
                          )}
                          {typeof activity.metadata.clustersCreated ===
                            "number" && (
                            <Badge variant="secondary">
                              {activity.metadata.clustersCreated} people
                            </Badge>
                          )}
                          {typeof activity.metadata.clusterName ===
                            "string" && (
                            <Badge variant="secondary">
                              &quot;{activity.metadata.clusterName}&quot;
                            </Badge>
                          )}
                        </div>
                      )}
                  </div>
                </div>

                {index < activities.length - 1 && (
                  <Separator className="my-3" />
                )}
              </div>
            ))}

            {hasMore && (
              <div className="text-center pt-4">
                <p className="text-sm text-gray-500">
                  Load more activities in the full activity view
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
