# Media Delete Functionality Guide 🗑️

## Overview

The media delete functionality allows users to delete single or multiple photos from their groups. It includes:

✅ **Select & Delete Multiple Photos** - Checkbox selection with bulk delete
✅ **Individual Photo Delete** - Hover to reveal delete button
✅ **Confirmation Dialog** - Prevents accidental deletions
✅ **Visual Feedback** - Loading states and toast notifications
✅ **Auto Refresh** - Gallery refreshes after successful deletion

---

## Components Created

### 1. **useDelete Hook** (`lib/hooks/useDelete.ts`)

Custom React hook for deleting media items.

**Features:**
- Delete single media item
- Delete multiple media items in parallel
- Loading state management
- Success/error toast notifications
- Callback on successful deletion

**Usage:**
```typescript
const { deleting, deleteMedia, deleteMultiple } = useDelete({
  onDeleteSuccess: () => {
    // Refresh gallery or perform other actions
    refetchMedia();
  },
});

// Delete single photo
await deleteMedia("media-id-123");

// Delete multiple photos
await deleteMultiple(["id-1", "id-2", "id-3"]);
```

### 2. **DeleteConfirmDialog** (`components/media/DeleteConfirmDialog.tsx`)

Beautiful confirmation dialog with red destructive styling.

**Features:**
- Shows count of photos being deleted
- Different message for single vs multiple photos
- Loading state during deletion
- Cancel and confirm actions
- Red warning theme

**Props:**
```typescript
interface DeleteConfirmDialogProps {
  open: boolean;                    // Dialog visibility
  onOpenChange: (open: boolean) => void;  // Dialog state handler
  onConfirm: () => void;            // Confirm deletion callback
  count: number;                    // Number of photos to delete
  loading?: boolean;                // Loading state
}
```

### 3. **Updated MediaGallery** (`components/media/MediaGallery.tsx`)

Enhanced with delete functionality.

**New Features:**
- ✅ Delete button in toolbar (when items selected)
- ✅ Individual delete button on each photo (hover in grid view)
- ✅ Delete button in list view
- ✅ Delete confirmation dialog
- ✅ Auto-refresh after deletion

**New Props:**
```typescript
interface MediaGalleryProps {
  media: Media[];
  loading?: boolean;
  groupId: string;
  onDownload?: (mediaIds: string[]) => void;
  onRefresh?: () => void;  // NEW: Callback to refresh media list
  selectedCluster?: string;
}
```

---

## How It Works

### User Flow

```
1. User selects photos (via checkboxes or individual delete button)
   ↓
2. User clicks "Delete (X)" button
   ↓
3. Confirmation dialog appears
   ↓
4. User confirms deletion
   ↓
5. Photos are deleted from backend (parallel API calls)
   ↓
6. Success toast notification appears
   ↓
7. Gallery refreshes automatically (via onRefresh callback)
```

### Technical Flow

```typescript
// 1. User clicks delete button
<Button onClick={handleDeleteClick}>
  Delete ({selectedMedia.size})
</Button>

// 2. Opens confirmation dialog
const handleDeleteClick = () => {
  setDeleteDialogOpen(true);
};

// 3. User confirms
<DeleteConfirmDialog onConfirm={handleDeleteConfirm} />

// 4. Execute deletion
const handleDeleteConfirm = async () => {
  await deleteMultiple(Array.from(selectedMedia));
};

// 5. useDelete hook handles API calls
const { deleteMultiple } = useDelete({
  onDeleteSuccess: () => {
    setSelectedMedia(new Set());     // Clear selection
    setDeleteDialogOpen(false);      // Close dialog
    onRefresh();                     // Refresh gallery
  },
});

// 6. API calls executed in parallel
await Promise.all(mediaIds.map((id) => mediaApi.delete(id)));

// 7. Success callback triggers
toast({ title: "Photos Deleted", ... });
```

---

## Integration Guide

### Using MediaGallery with Delete

```typescript
"use client";

import { useState, useEffect } from "react";
import { MediaGallery } from "@/components/media/MediaGallery";
import { mediaApi } from "@/lib/api/media";

export default function GroupMediaPage({ groupId }: { groupId: string }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch media
  const fetchMedia = async () => {
    setLoading(true);
    try {
      const response = await mediaApi.listByGroup(groupId);
      setMedia(response.data);
    } catch (error) {
      console.error("Failed to fetch media:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [groupId]);

  return (
    <MediaGallery
      media={media}
      loading={loading}
      groupId={groupId}
      onRefresh={fetchMedia}  // IMPORTANT: Pass refresh callback
    />
  );
}
```

**Key Points:**
1. Create a `fetchMedia` function to load media
2. Pass `fetchMedia` to `onRefresh` prop
3. MediaGallery will call `onRefresh` after successful deletion
4. Gallery automatically updates with fresh data

---

## UI/UX Features

### Grid View
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ ☑️ Photo 1  │  │ ☐ Photo 2  │  │ ☑️ Photo 3  │
│             │  │             │  │             │
│   [image]   │  │   [image]   │  │   [image]   │
│             │  │             │  │         🗑️  │  ← Delete button on hover
└─────────────┘  └─────────────┘  └─────────────┘

[✅ 2 selected]              [🗑️ Delete (2)]  [⬇️ Download (2)]
```

### List View
```
☑️ [thumbnail] Photo1.jpg     Jan 1, 2024  2.5 MB     [🗑️]
☐ [thumbnail] Photo2.jpg     Jan 2, 2024  3.1 MB     [🗑️]
☑️ [thumbnail] Photo3.jpg     Jan 3, 2024  1.8 MB     [🗑️]
```

### Delete Confirmation Dialog
```
┌─────────────────────────────────────────┐
│  🗑️  Delete Photos?                      │
├─────────────────────────────────────────┤
│                                         │
│  Are you sure you want to delete        │
│  3 photos? This action cannot be        │
│  undone and will permanently delete     │
│  the selected photos from storage.      │
│                                         │
│               [Cancel]  [🗑️ Delete 3 Photos] │
└─────────────────────────────────────────┘
```

---

## API Integration

### Backend Endpoint

The delete functionality uses the existing backend endpoint:

```typescript
DELETE /api/media/:id
```

**Implementation** (`backend/src/presentation/controllers/MediaController.ts:138`):
```typescript
delete = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.auth!.userId;
  const mediaId = req.params.id;

  const media = await this.mediaRepository.findById(mediaId);
  if (!media) {
    throw new NotFoundError('Media not found');
  }

  // Verify user has permission to delete
  const group = await this.groupRepository.findByIdAndUserId(media.groupId, userId);
  if (!group) {
    throw new ForbiddenError('You do not have access to this group');
  }

  if (!group.canDelete(userId)) {
    throw new ForbiddenError('You do not have permission to delete media');
  }

  // Delete from S3
  await this.storageService.deleteFile(media.s3Key);

  // Delete from database
  await this.mediaRepository.delete(mediaId);

  // Update group storage usage
  await this.groupRepository.updateStorageUsed(media.groupId, -media.fileSize);

  // Invalidate caches
  await this.cacheService.delete(CacheKeys.media(mediaId));
  await this.cacheService.deletePattern(`media:group:${media.groupId}:page:*`);
  await this.cacheService.delete(CacheKeys.groupStorage(media.groupId));

  return res.json({
    success: true,
    message: 'Media deleted successfully',
  });
});
```

**What it does:**
1. ✅ Verifies user has permission to delete
2. ✅ Deletes file from S3 storage
3. ✅ Removes database record
4. ✅ Updates group storage usage
5. ✅ Invalidates relevant caches

---

## Error Handling

### Permission Denied
```typescript
// Backend checks permissions
if (!group.canDelete(userId)) {
  throw new ForbiddenError('You do not have permission to delete media');
}

// Frontend shows error toast
toast({
  title: "Delete Failed",
  description: "You don't have permission to delete media",
  variant: "destructive",
});
```

### Network Errors
```typescript
try {
  await deleteMultiple(mediaIds);
} catch (error) {
  toast({
    title: "Delete Failed",
    description: error.message || "Failed to delete photos",
    variant: "destructive",
  });
}
```

### Partial Failures
```typescript
// If some deletions fail in bulk operation
const results = await Promise.allSettled(
  mediaIds.map((id) => mediaApi.delete(id))
);

const failed = results.filter(r => r.status === 'rejected');
if (failed.length > 0) {
  toast({
    title: "Some photos failed to delete",
    description: `${failed.length} out of ${mediaIds.length} failed`,
    variant: "destructive",
  });
}
```

---

## Permissions

Users can only delete photos if they have the `canDelete` permission in the group.

**Permission Check** (`backend/src/core/entities/Group.ts`):
```typescript
canDelete(userId: string): boolean {
  const member = this.getMember(userId);
  if (!member) return false;

  // Admin can always delete
  if (member.role === MemberRole.ADMIN) return true;

  // Check permissions
  return member.permissions?.canDelete ?? false;
}
```

**Roles:**
- **Admin**: Can delete any photo
- **Member**: Can delete if `canDelete` permission is enabled
- **Viewer**: Cannot delete (read-only)

---

## Testing

### Manual Testing

1. **Single Photo Delete:**
   - Hover over a photo in grid view
   - Click the red delete button
   - Confirm deletion
   - Verify photo is removed

2. **Bulk Delete:**
   - Select multiple photos using checkboxes
   - Click "Delete (X)" button in toolbar
   - Confirm deletion
   - Verify all selected photos are removed

3. **List View Delete:**
   - Switch to list view
   - Click delete button next to any photo
   - Confirm deletion
   - Verify photo is removed

4. **Cancel Delete:**
   - Select photos and click delete
   - Click "Cancel" in confirmation dialog
   - Verify photos are NOT deleted

5. **Permission Test:**
   - Login as a user without delete permission
   - Try to delete a photo
   - Verify error message appears

### Automated Testing

```typescript
// Test useDelete hook
describe("useDelete", () => {
  it("should delete single media item", async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(() => useDelete({ onDeleteSuccess: onSuccess }));

    await act(async () => {
      await result.current.deleteMedia("media-123");
    });

    expect(onSuccess).toHaveBeenCalled();
  });

  it("should delete multiple media items", async () => {
    const { result } = renderHook(() => useDelete());

    await act(async () => {
      const success = await result.current.deleteMultiple(["id-1", "id-2"]);
      expect(success).toBe(true);
    });
  });
});
```

---

## Common Issues & Solutions

### Issue: Photos don't refresh after deletion
**Solution:** Make sure you pass `onRefresh` prop to MediaGallery:
```typescript
<MediaGallery onRefresh={fetchMedia} />
```

### Issue: Delete button doesn't appear on hover
**Solution:** Check CSS group-hover is working. Try disabling browser extensions.

### Issue: "Permission denied" error
**Solution:** Check user role and permissions in the group. Only admin and members with canDelete can delete.

### Issue: Photos deleted but storage not updated
**Solution:** Backend automatically updates storage. Check backend logs for errors. Clear browser cache.

---

## Best Practices

1. ✅ **Always confirm before deleting** - Use DeleteConfirmDialog
2. ✅ **Provide visual feedback** - Show loading states and toasts
3. ✅ **Handle errors gracefully** - Show user-friendly error messages
4. ✅ **Refresh after deletion** - Update UI automatically
5. ✅ **Check permissions** - Verify user can delete before showing button
6. ✅ **Optimize for bulk operations** - Delete in parallel for speed
7. ✅ **Clear selections** - Reset selection state after successful deletion

---

## Future Enhancements

Possible improvements:

- **Undo Delete** - Soft delete with 30-day recovery period
- **Move to Trash** - Trash bin before permanent deletion
- **Bulk Select Options** - Select by date range, size, or face
- **Keyboard Shortcuts** - Delete key to delete selected
- **Drag to Delete** - Drag photos to trash icon
- **Delete Analytics** - Track what types of photos are deleted

---

## Summary

The delete functionality is now fully integrated! Users can:

✅ Select and delete multiple photos with checkboxes
✅ Delete individual photos with hover button (grid view)
✅ Delete photos from list view
✅ See confirmation dialog before deletion
✅ Get visual feedback with loading states and toasts
✅ Auto-refresh gallery after successful deletion

**Key files:**
- `lib/hooks/useDelete.ts` - Delete logic
- `components/media/DeleteConfirmDialog.tsx` - Confirmation UI
- `components/media/MediaGallery.tsx` - Gallery with delete buttons

**Usage:**
```typescript
<MediaGallery
  media={media}
  groupId={groupId}
  onRefresh={fetchMedia}  // Enable auto-refresh
/>
```

That's it! Your users can now safely delete photos with a great UX! 🎉
