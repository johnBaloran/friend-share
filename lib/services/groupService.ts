// lib/services/groupService.ts
import { Group, IGroup, IGroupMember } from "@/lib/models/Group";
import connectDB from "@/lib/config/database";
import mongoose from "mongoose";

export class GroupService {
  static async createGroup(
    name: string,
    creatorId: string,
    description?: string,
    autoDeleteDays?: number
  ): Promise<IGroup> {
    await connectDB();

    const inviteCode =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    const group = await Group.create({
      name,
      description,
      inviteCode,
      creatorId,
      autoDeleteDays: autoDeleteDays || 30,
      members: [
        {
          userId: new mongoose.Types.ObjectId(creatorId),
          role: "ADMIN" as const,
          permissions: {
            canUpload: true,
            canDownload: true,
            canDelete: true,
          },
          joinedAt: new Date(),
        },
      ],
    });

    return group;
  }

  static async getUserGroups(userId: string): Promise<IGroup[]> {
    await connectDB();

    return await Group.find({
      "members.userId": userId,
    })
      .populate("members.userId", "name email avatar")
      .sort({ createdAt: -1 });
  }

  static async getGroupById(
    groupId: string,
    userId: string
  ): Promise<IGroup | null> {
    await connectDB();

    const group = await Group.findOne({
      _id: groupId,
      "members.userId": userId,
    }).populate("members.userId", "name email avatar");

    return group;
  }

  static async joinGroup(inviteCode: string, userId: string): Promise<IGroup> {
    await connectDB();

    const group = await Group.findOne({ inviteCode });

    if (!group) {
      throw new Error("Invalid invite code");
    }

    // Check if user is already a member with proper typing
    const isAlreadyMember = group.members.some(
      (member: IGroupMember) => member.userId.toString() === userId
    );

    if (isAlreadyMember) {
      throw new Error("You are already a member of this group");
    }

    // Add user to group
    group.members.push({
      userId: new mongoose.Types.ObjectId(userId),
      role: "MEMBER" as const,
      permissions: {
        canUpload: true,
        canDownload: true,
        canDelete: false,
      },
      joinedAt: new Date(),
    });

    await group.save();
    return group;
  }
}
