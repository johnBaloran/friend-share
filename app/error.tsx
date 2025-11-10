"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, Home, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="max-w-md w-full p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-3 bg-destructive/10 rounded-full">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Something went wrong!</h1>
            <p className="text-muted-foreground">
              An unexpected error occurred. Please try again or contact support if
              the problem persists.
            </p>
          </div>

          {process.env.NODE_ENV === "development" && error.message && (
            <details className="w-full text-left">
              <summary className="cursor-pointer text-sm font-medium mb-2">
                Error Details
              </summary>
              <div className="bg-muted p-3 rounded-md text-xs font-mono overflow-auto">
                <p className="text-destructive">{error.message}</p>
                {error.stack && (
                  <pre className="mt-2 text-muted-foreground whitespace-pre-wrap">
                    {error.stack}
                  </pre>
                )}
              </div>
            </details>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={reset} variant="default" className="flex-1">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
