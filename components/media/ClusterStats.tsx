"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Camera, TrendingUp, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { groupsApi } from "@/lib/api/groups";
import { Cluster } from "@/lib/api/clusters";

interface ClusterStatsProps {
  clusters: Cluster[];
  totalMedia: number;
  loading?: boolean;
  groupId?: string;
  onReclusterComplete?: () => void;
}

export function ClusterStats({
  clusters,
  totalMedia,
  loading = false,
  groupId,
  onReclusterComplete,
}: ClusterStatsProps) {
  const [reclustering, setReclustering] = useState(false);
  const { toast } = useToast();

  const handleRecluster = async () => {
    if (!groupId) return;

    setReclustering(true);
    try {
      const result = await groupsApi.recluster(groupId);
      toast({
        title: "Success",
        description: result.message || "Face reclustering job started",
      });
      onReclusterComplete?.();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to start reclustering",
        variant: "destructive",
      });
    } finally {
      setReclustering(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
        </CardContent>
      </Card>
    );
  }

  const totalFaces = clusters.reduce(
    (sum, cluster) => sum + cluster.appearanceCount,
    0
  );

  const averageConfidence =
    clusters.length > 0
      ? clusters.reduce((sum, cluster) => sum + cluster.confidence, 0) /
        clusters.length
      : 0;

  const topPerson =
    clusters.length > 0
      ? clusters.reduce((max, cluster) =>
          cluster.appearanceCount > max.appearanceCount ? cluster : max
        )
      : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Face Detection Stats</CardTitle>
        {groupId && clusters.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecluster}
            disabled={reclustering}
            className="h-8"
          >
            <RefreshCw
              className={`h-3 w-3 mr-1 ${reclustering ? "animate-spin" : ""}`}
            />
            {reclustering ? "Re-clustering..." : "Re-cluster"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-2">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {clusters.length}
            </p>
            <p className="text-sm text-gray-500">Unique People</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-2">
              <Camera className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalFaces}</p>
            <p className="text-sm text-gray-500">Face Appearances</p>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Photos Analyzed</span>
            <Badge variant="secondary" className="text-xs">
              {totalMedia} {totalMedia === 1 ? "photo" : "photos"}
            </Badge>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Avg. Confidence</span>
            <Badge
              variant={averageConfidence > 0.7 ? "default" : "secondary"}
              className="text-xs"
            >
              {Math.round(averageConfidence * 100)}%
            </Badge>
          </div>

          {topPerson && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Most Frequent</span>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {topPerson.clusterName || "Unknown Person"}
                </p>
                <p className="text-xs text-gray-500">
                  {topPerson.appearanceCount} appearance
                  {topPerson.appearanceCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}
        </div>

        {clusters.length === 0 && (
          <div className="text-center py-4 text-gray-500 border-t">
            <TrendingUp className="mx-auto h-8 w-8 mb-2 text-gray-300" />
            <p className="text-sm">Upload photos to see face detection stats</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
