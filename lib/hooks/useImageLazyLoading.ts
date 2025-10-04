import { useState, useEffect, useRef, useCallback } from "react";

interface UseImageLazyLoadingOptions {
  threshold?: number;
  rootMargin?: string;
}

export function useImageLazyLoading({
  threshold = 0.1,
  rootMargin = "50px",
}: UseImageLazyLoadingOptions = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded) {
          setIsIntersecting(true);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(img);

    return () => observer.disconnect();
  }, [threshold, rootMargin, hasLoaded]);

  const handleLoad = useCallback(() => {
    setHasLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setHasLoaded(true);
  }, []);

  return {
    imgRef,
    shouldLoad: isIntersecting || hasLoaded,
    isLoaded: hasLoaded,
    handleLoad,
    handleError,
  };
}
