import mongoose, { Schema } from 'mongoose';

const sharePermissionsSchema = new Schema({
  canView: { type: Boolean, required: true, default: true },
  canDownload: { type: Boolean, required: true, default: false },
}, { _id: false });

const shareableLinkSchema = new Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  resourceType: {
    type: String,
    required: true,
    enum: ['group', 'media', 'cluster'],
    index: true,
  },
  resourceId: {
    type: String,
    required: true,
    index: true,
  },
  createdBy: {
    type: String,
    required: true,
    index: true,
  },
  permissions: {
    type: sharePermissionsSchema,
    required: true,
  },
  expiresAt: {
    type: Date,
    default: null,
    index: true,
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true,
    index: true,
  },
  accessCount: {
    type: Number,
    required: true,
    default: 0,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
shareableLinkSchema.index({ resourceType: 1, resourceId: 1 });
shareableLinkSchema.index({ createdBy: 1, createdAt: -1 });
shareableLinkSchema.index({ isActive: 1, expiresAt: 1 });

export const ShareableLinkModel = mongoose.model('ShareableLink', shareableLinkSchema);
