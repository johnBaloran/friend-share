// lib/middleware/clerkAuth.ts
import { auth } from "@clerk/nextjs/server";
import { UserSyncService } from "@/lib/services/userSync";
import { IUser } from "@/lib/models/User";

export async function getAuthenticatedUser(): Promise<IUser | null> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return null;
    }

    const user = await UserSyncService.getOrCreateUser();
    return user;
  } catch (error) {
    console.error("Auth error:", error);
    return null;
  }
}

export function createAuthMiddleware(requireAuth = true) {
  return async (): Promise<{ user: IUser | null } | Response> => {
    const user = await getAuthenticatedUser();

    if (requireAuth && !user) {
      return Response.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return { user };
  };
}
