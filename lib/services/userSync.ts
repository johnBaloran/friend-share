import { User, IUser } from "@/lib/models/User";
import connectDB from "@/lib/config/database";
import { currentUser } from "@clerk/nextjs/server";

export class UserSyncService {
  static async getOrCreateUser(): Promise<IUser> {
    await connectDB();

    const clerkUser = await currentUser();

    if (!clerkUser) {
      throw new Error("No authenticated user found");
    }

    // Try to find existing user
    let user = await User.findOne({ clerkId: clerkUser.id });

    if (!user) {
      // Create new user from Clerk data
      user = await User.create({
        clerkId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim(),
        avatar: clerkUser.imageUrl,
        emailVerified:
          clerkUser.emailAddresses[0]?.verification?.status === "verified"
            ? new Date()
            : undefined,
      });
    }

    return user;
  }

  static async getUserByClerkId(clerkId: string): Promise<IUser | null> {
    await connectDB();
    return await User.findOne({ clerkId });
  }
}
