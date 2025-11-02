"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { setGetToken } from "@/lib/api/client";

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    // Set the token getter function for the API client
    setGetToken(() => getToken());
  }, [getToken]);

  return <>{children}</>;
}
