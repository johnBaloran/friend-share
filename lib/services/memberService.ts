import { Group, IGroupMember } from "@/lib/models/Group";
import { IUser } from "@/lib/models/User";
import connectDB from "@/lib/config/database";
import mongoose from "mongoose";

export interface MemberInfo {
  _id: string;
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
  joinedAt: Date;
  lastActive?: Date;
  uploadCount: number;
  storageUsed: number;
}

export interface InviteInfo {
  email: string;
  role: "ADMIN" | "MEMBER" | "VIEWER";
  permissions: {
    canUpload: boolean;
    canDownload: boolean;
    canDelete: boolean;
  };
  invitedBy: string;
  invitedAt: Date;
  expiresAt: Date;
}

// Interface for group member with Mongoose subdocument _id
interface GroupMemberWithId extends IGroupMember {
  _id: mongoose.Types.ObjectId;
}

// Interface for populated member using intersection types
type PopulatedMember = Omit<GroupMemberWithId, "userId"> & {
  userId: IUser;
};

export class MemberService {
  static async getGroupMembers(groupId: string): Promise<MemberInfo[]> {
    await connectDB();

    const group = await Group.findById(groupId).populate(
      "members.userId",
      "name email avatar"
    );

    if (!group) {
      throw new Error("Group not found");
    }

    // Get upload statistics for each member
    const memberStats = await Group.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(groupId) } },
      { $unwind: "$members" },
      {
        $lookup: {
          from: "media",
          let: { userId: "$members.userId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$uploaderId", "$$userId"] } } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalSize: { $sum: "$fileSize" },
              },
            },
          ],
          as: "uploadStats",
        },
      },
      {
        $project: {
          userId: "$members.userId",
          role: "$members.role",
          permissions: "$members.permissions",
          joinedAt: "$members.joinedAt",
          uploadCount: {
            $ifNull: [{ $arrayElemAt: ["$uploadStats.count", 0] }, 0],
          },
          storageUsed: {
            $ifNull: [{ $arrayElemAt: ["$uploadStats.totalSize", 0] }, 0],
          },
        },
      },
    ]);

    return (group.members as PopulatedMember[]).map(
      (member: PopulatedMember) => {
        const stats = memberStats.find(
          (stat: {
            userId: mongoose.Types.ObjectId;
            uploadCount: number;
            storageUsed: number;
          }) => stat.userId.toString() === member.userId._id.toString()
        );

        return {
          _id: member._id.toString(),
          userId: {
            _id: member.userId._id.toString(),
            name: member.userId.name,
            email: member.userId.email,
            avatar: member.userId.avatar,
          },
          role: member.role,
          permissions: member.permissions,
          joinedAt: member.joinedAt,
          uploadCount: stats?.uploadCount || 0,
          storageUsed: stats?.storageUsed || 0,
        };
      }
    );
  }

  static async updateMemberRole(
    groupId: string,
    memberId: string,
    newRole: "ADMIN" | "MEMBER" | "VIEWER",
    updatedBy: string
  ): Promise<void> {
    await connectDB();

    // Verify the updater is an admin
    const group = await Group.findOne({
      _id: groupId,
      members: {
        $elemMatch: {
          userId: updatedBy,
          role: "ADMIN",
        },
      },
    });

    if (!group) {
      throw new Error("Only admins can update member roles");
    }

    // Prevent removing the last admin
    if (newRole !== "ADMIN") {
      const adminCount = group.members.filter(
        (m: GroupMemberWithId) => m.role === "ADMIN"
      ).length;
      const targetMember = group.members.find(
        (m: GroupMemberWithId) => m._id.toString() === memberId
      );

      if (adminCount === 1 && targetMember?.role === "ADMIN") {
        throw new Error("Cannot remove the last admin from the group");
      }
    }

    // Set default permissions based on role
    const permissions = this.getDefaultPermissions(newRole);

    await Group.updateOne(
      {
        _id: groupId,
        "members._id": memberId,
      },
      {
        $set: {
          "members.$.role": newRole,
          "members.$.permissions": permissions,
        },
      }
    );
  }

  static async updateMemberPermissions(
    groupId: string,
    memberId: string,
    permissions: {
      canUpload: boolean;
      canDownload: boolean;
      canDelete: boolean;
    },
    updatedBy: string
  ): Promise<void> {
    await connectDB();

    // Verify the updater is an admin
    const group = await Group.findOne({
      _id: groupId,
      members: {
        $elemMatch: {
          userId: updatedBy,
          role: "ADMIN",
        },
      },
    });

    if (!group) {
      throw new Error("Only admins can update member permissions");
    }

    await Group.updateOne(
      {
        _id: groupId,
        "members._id": memberId,
      },
      {
        $set: {
          "members.$.permissions": permissions,
        },
      }
    );
  }

  static async removeMember(
    groupId: string,
    memberId: string,
    removedBy: string
  ): Promise<void> {
    await connectDB();

    const group = await Group.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    // Verify the remover is an admin or the member is removing themselves
    const removerMember = group.members.find(
      (m: GroupMemberWithId) => m.userId.toString() === removedBy
    );
    const targetMember = group.members.find(
      (m: GroupMemberWithId) => m._id.toString() === memberId
    );

    if (!removerMember) {
      throw new Error("User not found in group");
    }

    if (!targetMember) {
      throw new Error("Target member not found");
    }

    const isSelfRemoval = targetMember.userId.toString() === removedBy;
    const isAdminRemoval = removerMember.role === "ADMIN";

    if (!isSelfRemoval && !isAdminRemoval) {
      throw new Error("Only admins can remove other members");
    }

    // Prevent removing the last admin
    const adminCount = group.members.filter(
      (m: GroupMemberWithId) => m.role === "ADMIN"
    ).length;
    if (adminCount === 1 && targetMember.role === "ADMIN") {
      throw new Error("Cannot remove the last admin from the group");
    }

    await Group.updateOne(
      { _id: groupId },
      { $pull: { members: { _id: memberId } } }
    );
  }

  static async generateInviteCode(
    groupId: string,
    adminId: string
  ): Promise<string> {
    await connectDB();

    // Verify admin permissions
    const group = await Group.findOne({
      _id: groupId,
      members: {
        $elemMatch: {
          userId: adminId,
          role: "ADMIN",
        },
      },
    });

    if (!group) {
      throw new Error("Only admins can generate invite codes");
    }

    const newInviteCode =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    await Group.findByIdAndUpdate(groupId, {
      inviteCode: newInviteCode,
    });

    return newInviteCode;
  }

  private static getDefaultPermissions(role: "ADMIN" | "MEMBER" | "VIEWER") {
    switch (role) {
      case "ADMIN":
        return {
          canUpload: true,
          canDownload: true,
          canDelete: true,
        };
      case "MEMBER":
        return {
          canUpload: true,
          canDownload: true,
          canDelete: false,
        };
      case "VIEWER":
        return {
          canUpload: false,
          canDownload: true,
          canDelete: false,
        };
      default:
        return {
          canUpload: false,
          canDownload: false,
          canDelete: false,
        };
    }
  }
}
