import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  _id: string;
  clerkId: string; // Clerk user ID
  email: string;
  name?: string;
  avatar?: string;
  emailVerified?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    avatar: String,
    emailVerified: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
// userSchema.index({ clerkId: 1 });
// userSchema.index({ email: 1 });

export const User =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);
