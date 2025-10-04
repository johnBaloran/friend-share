"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { CreateGroupForm } from "@/components/forms/CreateGroupForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, Plus } from "lucide-react";

// API response types (what we actually receive from the API)
interface ApiGroupMember {
  userId: {
    _id: string;
    name?: string;
    email: string;
    avatar?: string;
  };
  role: "ADMIN" | "MEMBER" | "VIEWER";
  permissions: {
    canUpload: boolean;
    canDownload: boolean;
    canDelete: boolean;
  };
  joinedAt: string;
}

interface ApiGroup {
  _id: string;
  name: string;
  description?: string;
  members: ApiGroupMember[];
  createdAt: string;
  updatedAt: string;
  storageUsed: number;
  storageLimit: number;
  inviteCode: string;
  creatorId: string;
  autoDeleteDays: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const [groups, setGroups] = useState<ApiGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadGroups = async (): Promise<void> => {
    try {
      const response = await fetch("/api/groups");
      const result = await response.json();

      if (result.success) {
        setGroups(result.data);
      }
    } catch (error) {
      console.error("Failed to load groups:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadGroups();
    }
  }, [user]);

  const handleGroupCreated = (): void => {
    // Reload groups to get the properly formatted data from API
    loadGroups();
    setShowCreateForm(false);
  };

  const handleGroupClick = (groupId: string): void => {
    router.push(`/groups/${groupId}`);
  };

  const formatStorageUsed = (bytes: number): string => {
    return `${Math.round(bytes / 1024 / 1024)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onCreateGroup={() => setShowCreateForm(true)} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Groups</h2>
          <p className="text-gray-600">
            Organize and share photos with face recognition
          </p>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No groups yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first group to start sharing photos
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <Card
                key={group._id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleGroupClick(group._id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                    <Badge variant="secondary">
                      {group.members.length} member
                      {group.members.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  {group.description && (
                    <CardDescription>{group.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Storage used</span>
                      <span className="font-medium">
                        {formatStorageUsed(group.storageUsed)} /{" "}
                        {formatStorageUsed(group.storageLimit)}
                      </span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            (group.storageUsed / group.storageLimit) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {new Date(group.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
          <DialogContent className="sm:max-w-md">
            <CreateGroupForm
              onSuccess={handleGroupCreated}
              onCancel={() => setShowCreateForm(false)}
            />
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
