"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Camera, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FaceClusterCardProps {
  cluster: {
    id: string;
    clusterName?: string;
    appearanceCount: number;
    confidence: number;
    samplePhoto?: {
      url: string;
      boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    };
    totalPhotos: number;
  };
  groupId: string;
  onNameUpdate?: (clusterId: string, name: string) => Promise<void>;
}

export function FaceClusterCard({
  cluster,
  groupId,
  onNameUpdate,
}: FaceClusterCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(cluster.clusterName || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSave = async () => {
    if (!onNameUpdate || !name.trim()) return;

    setIsUpdating(true);
    try {
      await onNameUpdate(cluster.id, name);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update cluster name:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setName(cluster.clusterName || "");
    setIsEditing(false);
  };

  return (
    <Link href={`/groups/${groupId}/people/${cluster.id}`}>
      <Card
        className={cn(
          "group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105",
          "bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800",
          "border-2 hover:border-blue-300 dark:hover:border-blue-700"
        )}
      >
        {/* Sample Photo with Face Crop */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900">
          {cluster.samplePhoto ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <Image
                src={cluster.samplePhoto.url}
                alt={cluster.clusterName || "Person"}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
              {/* Face highlight overlay */}
              <div
                className="absolute border-4 border-blue-500 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  left: `${cluster.samplePhoto.boundingBox.x * 100}%`,
                  top: `${cluster.samplePhoto.boundingBox.y * 100}%`,
                  width: `${cluster.samplePhoto.boundingBox.width * 100}%`,
                  height: `${cluster.samplePhoto.boundingBox.height * 100}%`,
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Users className="h-16 w-16 text-gray-400" />
            </div>
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Stats badge */}
          <div className="absolute top-2 right-2">
            <Badge className="bg-black/70 text-white backdrop-blur-sm border-white/20">
              <Camera className="h-3 w-3 mr-1" />
              {cluster.totalPhotos}
            </Badge>
          </div>

          {/* Confidence indicator */}
          {cluster.confidence > 0.7 && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-green-500/90 text-white backdrop-blur-sm border-white/20">
                {Math.round(cluster.confidence * 100)}% match
              </Badge>
            </div>
          )}
        </div>

        {/* Info section */}
        <div className="p-4 space-y-2">
          {/* Name input/display */}
          {isEditing ? (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.preventDefault()}
            >
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name this person"
                className="h-8 text-sm"
                maxLength={50}
                autoFocus
                disabled={isUpdating}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={handleSave}
                disabled={isUpdating || !name.trim()}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleCancel}
                disabled={isUpdating}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm truncate flex-1">
                {cluster.clusterName || "Unknown Person"}
              </h3>
              {onNameUpdate && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsEditing(true);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}

          {/* Appearance count */}
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            Appears in {cluster.appearanceCount} photo
            {cluster.appearanceCount !== 1 ? "s" : ""}
          </p>

          {/* View button */}
          <Button
            size="sm"
            className="w-full mt-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
          >
            View All Photos
          </Button>
        </div>
      </Card>
    </Link>
  );
}
