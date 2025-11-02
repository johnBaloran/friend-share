import { Group } from '../../entities/Group.js';
import { PaginationParams, PaginatedResponse } from '../../../shared/types/index.js';

export interface IGroupRepository {
  create(group: Group): Promise<Group>;
  findById(id: string): Promise<Group | null>;
  findByIdAndUserId(groupId: string, userId: string): Promise<Group | null>;
  findByInviteCode(inviteCode: string): Promise<Group | null>;
  findByUserId(userId: string, pagination?: PaginationParams): Promise<PaginatedResponse<Group>>;
  update(id: string, group: Group): Promise<Group | null>;
  delete(id: string): Promise<boolean>;
  updateStorageUsed(groupId: string, bytesChange: number): Promise<void>;
  addMember(groupId: string, userId: string, role: string): Promise<Group | null>;
  removeMember(groupId: string, userId: string): Promise<Group | null>;
  getMemberCount(groupId: string): Promise<number>;
}
