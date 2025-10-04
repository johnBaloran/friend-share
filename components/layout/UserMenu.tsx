import { UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function UserMenu() {
  const { user } = useUser();

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild>
          <a href="/sign-in">Sign In</a>
        </Button>
        <Button asChild>
          <a href="/sign-up">Sign Up</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-muted-foreground">
        Welcome, {user.firstName || user.emailAddresses[0]?.emailAddress}
      </span>
      <UserButton
        afterSignOutUrl="/"
        appearance={{
          elements: {
            avatarBox: "w-8 h-8",
          },
        }}
      />
    </div>
  );
}
