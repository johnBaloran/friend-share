"use client";

import { useState } from "react";
import { useImageLazyLoading } from "@/lib/hooks/useImageLazyLoading";
import { Loader2 } from "lucide-react";

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  placeholder?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  className = "",
  fallbackSrc,
  placeholder,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [error, setError] = useState(false);
  const { imgRef, shouldLoad, isLoaded, handleLoad, handleError } =
    useImageLazyLoading();

  const handleImageLoad = (): void => {
    handleLoad();
    onLoad?.();
  };

  const handleImageError = (): void => {
    setError(true);
    handleError();
    onError?.();
  };

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {shouldLoad && !error ? (
        <>
          <img
            src={src}
            alt={alt}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
            decoding="async"
          />
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              {placeholder || (
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              )}
            </div>
          )}
        </>
      ) : error && fallbackSrc ? (
        <img
          src={fallbackSrc}
          alt={alt}
          className="w-full h-full object-cover"
          onLoad={handleImageLoad}
        />
      ) : (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          <span className="text-gray-400 text-sm">Failed to load</span>
        </div>
      )}
    </div>
  );
}
