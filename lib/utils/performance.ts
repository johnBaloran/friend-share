interface CustomPerformanceEntry {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

class PerformanceMonitor {
  private entries: CustomPerformanceEntry[] = [];
  private readonly maxEntries = 1000;

  startTimer(name: string): (metadata?: Record<string, unknown>) => void {
    const startTime = performance.now();

    return (metadata?: Record<string, unknown>) => {
      const duration = performance.now() - startTime;
      this.addEntry(name, duration, metadata);
    };
  }

  addEntry(
    name: string,
    duration: number,
    metadata?: Record<string, unknown>
  ): void {
    const entry: CustomPerformanceEntry = {
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    this.entries.push(entry);

    // Keep only the most recent entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Log slow operations in development
    if (process.env.NODE_ENV === "development" && duration > 1000) {
      console.warn(
        `Slow operation detected: ${name} took ${duration.toFixed(2)}ms`
      );
    }

    // Report to monitoring service in production
    if (process.env.NODE_ENV === "production" && duration > 5000) {
      // Example: reportPerformanceIssue(entry);
    }
  }

  getMetrics(timeWindowMs: number = 60000): {
    averageResponseTime: number;
    slowestOperations: CustomPerformanceEntry[];
    totalOperations: number;
  } {
    const cutoff = Date.now() - timeWindowMs;
    const recentEntries = this.entries.filter(
      (entry) => entry.timestamp > cutoff
    );

    const averageResponseTime =
      recentEntries.length > 0
        ? recentEntries.reduce((sum, entry) => sum + entry.duration, 0) /
          recentEntries.length
        : 0;

    const slowestOperations = recentEntries
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      averageResponseTime,
      slowestOperations,
      totalOperations: recentEntries.length,
    };
  }

  clearMetrics(): void {
    this.entries = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Helper for timing async operations
export async function timeOperation<T>(
  name: string,
  operation: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const stopTimer = performanceMonitor.startTimer(name);

  try {
    const result = await operation();
    stopTimer(metadata);
    return result;
  } catch (error) {
    stopTimer({ ...metadata, error: true });
    throw error;
  }
}

// Helper for timing sync operations
export function timeSync<T>(
  name: string,
  operation: () => T,
  metadata?: Record<string, unknown>
): T {
  const stopTimer = performanceMonitor.startTimer(name);

  try {
    const result = operation();
    stopTimer(metadata);
    return result;
  } catch (error) {
    stopTimer({ ...metadata, error: true });
    throw error;
  }
}
