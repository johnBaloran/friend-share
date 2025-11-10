import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MediaGallerySkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden animate-pulse">
          <Skeleton className="aspect-square w-full" />
          <div className="p-2 space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function FaceClusterSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden animate-pulse">
          <Skeleton className="aspect-square w-full" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-8 w-full mt-2" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function ProcessingIndicator() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 rounded-full"></div>
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
      </div>
      <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Processing your photos
      </h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-md">
        Our AI is detecting and grouping faces. This usually takes a few moments...
      </p>
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
        </div>
        <span>Analyzing images</span>
      </div>
    </div>
  );
}
