import { toast } from "@/hooks/use-toast";

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

export class NetworkError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number = 500, code?: string) {
    super(message);
    this.name = "NetworkError";
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends Error {
  details: Record<string, string>;

  constructor(message: string, details: Record<string, string> = {}) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

export function handleApiError(error: unknown): ApiError {
  console.error("API Error:", error);

  if (error instanceof NetworkError) {
    return {
      message: error.message,
      status: error.status,
      code: error.code,
    };
  }

  if (error instanceof ValidationError) {
    return {
      message: error.message,
      status: 400,
      code: "VALIDATION_ERROR",
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      status: 500,
    };
  }

  return {
    message: "An unexpected error occurred",
    status: 500,
  };
}

export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage?: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const apiError = handleApiError(error);

    toast({
      title: "Error",
      description: errorMessage || apiError.message,
      variant: "destructive",
    });

    // Report to error tracking service in production
    if (process.env.NODE_ENV === "production") {
      // Example: reportError(error, { context: 'withErrorHandling' });
    }

    return null;
  }
}

export function createFetch() {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = "Request failed";

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage;
        }

        throw new NetworkError(errorMessage, response.status);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new NetworkError("Request timed out", 408, "TIMEOUT");
      }

      throw error;
    }
  };
}
