"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Settings,
  Trash2,
  Shield,
  Eye,
  UserPlus,
  Loader2,
} from "lucide-react";
import { groupsApi, Member } from "@/lib/api/groups";

interface MemberManagerProps {
  groupId: string;
  currentUserId: string;
  isAdmin: boolean;
}

export function MemberManager({
  groupId,
  currentUserId,
  isAdmin,
}: MemberManagerProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const loadMembers = async (): Promise<void> => {
    try {
      const data = await groupsApi.getMembers(groupId);
      setMembers(data);
    } catch (error) {
      console.error("Failed to load members:", error);
      toast({
        title: "Error",
        description: "Failed to load group members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [groupId]);

  const updateMemberRole = async (
    memberId: string,
    newRole: string
  ): Promise<void> => {
    if (!isAdmin) return;

    setUpdating(memberId);
    try {
      await groupsApi.updateMember(groupId, memberId, { role: newRole });
      toast({
        title: "Success",
        description: "Member role updated successfully",
      });
      await loadMembers();
    } catch (error) {
      console.error("Failed to update member role:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update member role",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const updateMemberPermissions = async (
    memberId: string,
    permissions: {
      canUpload: boolean;
      canDownload: boolean;
      canDelete: boolean;
    }
  ): Promise<void> => {
    if (!isAdmin) return;

    setUpdating(memberId);
    try {
      await groupsApi.updateMember(groupId, memberId, { permissions });
      toast({
        title: "Success",
        description: "Member permissions updated successfully",
      });
      await loadMembers();
    } catch (error) {
      console.error("Failed to update member permissions:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update member permissions",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const removeMember = async (memberId: string): Promise<void> => {
    setUpdating(memberId);
    try {
      await groupsApi.removeMember(groupId, memberId);
      toast({
        title: "Success",
        description: "Member removed successfully",
      });
      await loadMembers();
    } catch (error) {
      console.error("Failed to remove member:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to remove member",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <Shield className="h-4 w-4 text-red-500" />;
      case "MEMBER":
        return <Users className="h-4 w-4 text-blue-500" />;
      case "VIEWER":
        return <Eye className="h-4 w-4 text-gray-500" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members ({members.length})
          </CardTitle>
          {isAdmin && (
            <Button size="sm" variant="outline">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Members
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {members.map((member) => {
            const isCurrentUser = member.userId === currentUserId;
            const canModify = isAdmin && !isCurrentUser;

            return (
              <div
                key={member.userId}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {member.userId.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{member.userId}</p>
                      {isCurrentUser && (
                        <Badge variant="secondary" className="text-xs">
                          You
                        </Badge>
                      )}
                      {getRoleIcon(member.role)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                      <span>
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Role Selection */}
                  {canModify ? (
                    <Select
                      value={member.role}
                      onValueChange={(value) =>
                        updateMemberRole(member.userId, value)
                      }
                      disabled={updating === member.userId}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="MEMBER">Member</SelectItem>
                        <SelectItem value="VIEWER">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline">{member.role.toLowerCase()}</Badge>
                  )}

                  {/* Permissions Dialog */}
                  {canModify && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Member Permissions</DialogTitle>
                          <DialogDescription>
                            Configure permissions for {member.userId}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`upload-${member.userId}`}
                                checked={member.permissions.canUpload}
                                onCheckedChange={(checked) =>
                                  updateMemberPermissions(member.userId, {
                                    ...member.permissions,
                                    canUpload: Boolean(checked),
                                  })
                                }
                              />
                              <label
                                htmlFor={`upload-${member.userId}`}
                                className="text-sm"
                              >
                                Can upload photos
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`download-${member.userId}`}
                                checked={member.permissions.canDownload}
                                onCheckedChange={(checked) =>
                                  updateMemberPermissions(member.userId, {
                                    ...member.permissions,
                                    canDownload: Boolean(checked),
                                  })
                                }
                              />
                              <label
                                htmlFor={`download-${member.userId}`}
                                className="text-sm"
                              >
                                Can download photos
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`delete-${member.userId}`}
                                checked={member.permissions.canDelete}
                                onCheckedChange={(checked) =>
                                  updateMemberPermissions(member.userId, {
                                    ...member.permissions,
                                    canDelete: Boolean(checked),
                                  })
                                }
                              />
                              <label
                                htmlFor={`delete-${member.userId}`}
                                className="text-sm"
                              >
                                Can delete photos
                              </label>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}

                  {/* Remove Member */}
                  {(canModify || isCurrentUser) && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            {isCurrentUser ? "Leave Group" : "Remove Member"}
                          </DialogTitle>
                          <DialogDescription>
                            {isCurrentUser
                              ? "Are you sure you want to leave this group? You will lose access to all photos and data."
                              : `Are you sure you want to remove ${member.userId} from this group?`}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => removeMember(member.userId)}
                            variant="destructive"
                            disabled={updating === member.userId}
                            className="flex-1"
                          >
                            {updating === member.userId ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            {isCurrentUser ? "Leave Group" : "Remove Member"}
                          </Button>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="flex-1">
                              Cancel
                            </Button>
                          </DialogTrigger>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}

                  {updating === member.userId && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
