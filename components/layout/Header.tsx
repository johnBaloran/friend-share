"use client";

import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface HeaderProps {
  onCreateGroup?: () => void;
}

export function Header({ onCreateGroup }: HeaderProps) {
  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">FaceShare</h1>
        </div>

        <div className="flex items-center space-x-4">
          {onCreateGroup && (
            <Button onClick={onCreateGroup} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Group
            </Button>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  );
}
