"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { groupsApi } from "@/lib/api/groups";

export default function JoinGroupPage() {
  const params = useParams();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const code = params.code as string;

  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>("");

  useEffect(() => {
    // Once user is loaded and signed in, join the group
    if (isLoaded && isSignedIn && !joined && !joining && !error) {
      joinGroup();
    }
  }, [isLoaded, isSignedIn]);

  const joinGroup = async () => {
    setJoining(true);
    setError(null);

    try {
      const group = await groupsApi.join(code);
      setGroupName(group.name);
      setJoined(true);

      // Redirect to group page after 2 seconds
      setTimeout(() => {
        router.push(`/groups/${group.id}`);
      }, 2000);
    } catch (err: unknown) {
      console.error("Failed to join group:", err);
      const message = err instanceof Error ? err.message : "Failed to join group. The invite code may be invalid.";
      setError(message);
      setJoining(false);
    }
  };

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-12 pb-12 text-center">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not signed in - redirect to sign-in
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <UserPlus className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              You&apos;re Invited!
            </h1>
            <p className="text-gray-600 mb-6">
              Sign in to join this photo group and start sharing memories.
            </p>
            <Button
              onClick={() => {
                // Redirect to sign-in with return URL
                router.push(`/sign-in?redirect_url=/join/${code}`);
              }}
              size="lg"
              className="w-full"
            >
              Sign In to Continue
            </Button>
            <p className="text-sm text-gray-500 mt-4">
              Don&apos;t have an account?{" "}
              <a
                href={`/sign-up?redirect_url=/join/${code}`}
                className="text-blue-600 hover:underline"
              >
                Sign up
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-12 pb-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Unable to Join Group
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => router.push("/dashboard")} variant="outline">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (joined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-12 pb-12 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome to {groupName}!
            </h2>
            <p className="text-gray-600 mb-4">
              You&apos;ve successfully joined the group.
            </p>
            <p className="text-sm text-gray-500">
              Redirecting you to the group...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Joining state
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-12 pb-12 text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Joining group...</p>
        </CardContent>
      </Card>
    </div>
  );
}
