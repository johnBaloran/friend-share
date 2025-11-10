"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2 } from "lucide-react";
import { groupsApi, Group } from "@/lib/api/groups";
import { useRouter } from "next/navigation";

interface GroupSettingsModalProps {
  group: Group;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedGroup: Group) => void;
}

export function GroupSettingsModal({
  group,
  isOpen,
  onClose,
  onUpdate,
}: GroupSettingsModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: group.name,
    description: group.description || "",
    storageLimit: Math.round(group.storageLimit / 1024 / 1024), // Convert to MB
    autoDeleteDays: group.autoDeleteDays,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.name.trim().length < 3) {
      newErrors.name = "Group name must be at least 3 characters";
    }

    if (formData.name.length > 100) {
      newErrors.name = "Group name must not exceed 100 characters";
    }

    if (formData.description.length > 500) {
      newErrors.description = "Description must not exceed 500 characters";
    }

    const storageLimitBytes = formData.storageLimit * 1024 * 1024;
    if (storageLimitBytes < group.storageUsed) {
      newErrors.storageLimit = `Storage limit cannot be less than current usage (${Math.round(group.storageUsed / 1024 / 1024)} MB)`;
    }

    if (formData.autoDeleteDays < 0 || formData.autoDeleteDays > 365) {
      newErrors.autoDeleteDays = "Auto-delete days must be between 0 and 365";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const updatedGroup = await groupsApi.update(group.id, {
        name: formData.name,
        description: formData.description,
        storageLimit: formData.storageLimit * 1024 * 1024, // Convert MB to bytes
        autoDeleteDays: formData.autoDeleteDays,
      });

      onUpdate(updatedGroup);
      onClose();
    } catch (error: unknown) {
      console.error("Failed to update group:", error);
      setErrors({ general: error instanceof Error ? error.message : "Failed to update group settings" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await groupsApi.delete(group.id);
      router.push("/dashboard");
    } catch (error: unknown) {
      console.error("Failed to delete group:", error);
      setErrors({ general: error instanceof Error ? error.message : "Failed to delete group" });
      setShowDeleteConfirm(false);
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Group Settings</DialogTitle>
            <DialogDescription>
              Update your group settings or delete the group
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {errors.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {errors.general}
              </div>
            )}

            {/* Group Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter group name"
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter group description (optional)"
                rows={3}
                className={errors.description ? "border-red-500" : ""}
              />
              <p className="text-xs text-gray-500">
                {formData.description.length}/500 characters
              </p>
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description}</p>
              )}
            </div>

            {/* Storage Limit */}
            <div className="space-y-2">
              <Label htmlFor="storageLimit">Storage Limit (MB) *</Label>
              <Input
                id="storageLimit"
                type="number"
                min={Math.round(group.storageUsed / 1024 / 1024)}
                value={formData.storageLimit}
                onChange={(e) => setFormData({ ...formData, storageLimit: parseInt(e.target.value) || 0 })}
                className={errors.storageLimit ? "border-red-500" : ""}
              />
              <p className="text-xs text-gray-500">
                Current usage: {Math.round(group.storageUsed / 1024 / 1024)} MB
              </p>
              {errors.storageLimit && (
                <p className="text-sm text-red-500">{errors.storageLimit}</p>
              )}
            </div>

            {/* Auto-Delete Days */}
            <div className="space-y-2">
              <Label htmlFor="autoDeleteDays">Auto-Delete After (Days) *</Label>
              <Input
                id="autoDeleteDays"
                type="number"
                min={0}
                max={365}
                value={formData.autoDeleteDays}
                onChange={(e) => setFormData({ ...formData, autoDeleteDays: parseInt(e.target.value) || 0 })}
                className={errors.autoDeleteDays ? "border-red-500" : ""}
              />
              <p className="text-xs text-gray-500">
                Set to 0 to disable automatic deletion
              </p>
              {errors.autoDeleteDays && (
                <p className="text-sm text-red-500">{errors.autoDeleteDays}</p>
              )}
            </div>

            {/* Danger Zone */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-red-600 mb-2">Danger Zone</h3>
              <p className="text-xs text-gray-600 mb-3">
                Deleting this group will permanently remove all photos, face clusters, and data.
                This action cannot be undone.
              </p>
              <Button
                variant="outline"
                className="w-full border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Group
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-semibold">{group.name}</span> and all
              associated data including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All uploaded photos and videos</li>
                <li>All face clusters and detections</li>
                <li>All member access</li>
              </ul>
              <p className="mt-3 font-semibold text-red-600">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
