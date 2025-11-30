"use client";

import { Users, Loader2 } from "lucide-react";

interface FaceGroupingSkeletonProps {
  photoCount?: number;
}

export function FaceGroupingSkeleton({
  photoCount = 0,
}: FaceGroupingSkeletonProps) {
  // Show 3-5 skeleton cards
  const skeletonCount = Math.min(Math.max(3, Math.ceil(photoCount / 10)), 5);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
          <h2 className="text-lg font-semibold text-gray-700">
            Grouping faces with AI...
          </h2>
        </div>
        <p className="text-sm text-gray-500">
          {photoCount} photo{photoCount !== 1 ? "s" : ""} uploaded
        </p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {/* All Photos - Static */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-lg border-2 border-gray-200 opacity-50">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Users className="h-8 w-8 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-400">
            Processing...
          </span>
          <span className="text-xs text-gray-400">-</span>
        </div>

        {/* Skeleton Face Cards */}
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <div
            key={index}
            className="flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-lg border-2 border-gray-200 animate-pulse"
          >
            {/* Anonymous Face Icon */}
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
              <Users className="h-8 w-8 text-gray-400" />
            </div>

            {/* Skeleton Name */}
            <div className="h-4 w-16 bg-gray-200 rounded"></div>

            {/* Skeleton Count */}
            <div className="h-3 w-8 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
