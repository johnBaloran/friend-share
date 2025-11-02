import { IUserRepository } from '../../../../core/interfaces/repositories/IUserRepository.js';
import { User } from '../../../../core/entities/User.js';
import { UserModel, IUserDocument } from '../models/UserModel.js';

export class MongoUserRepository implements IUserRepository {
  async create(user: User): Promise<User> {
    const doc = await UserModel.create({
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      emailVerified: user.emailVerified,
    });

    return this.toEntity(doc);
  }

  async findById(id: string): Promise<User | null> {
    const doc = await UserModel.findById(id);
    return doc ? this.toEntity(doc) : null;
  }

  async findByClerkId(clerkId: string): Promise<User | null> {
    const doc = await UserModel.findOne({ clerkId });
    return doc ? this.toEntity(doc) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await UserModel.findOne({ email });
    return doc ? this.toEntity(doc) : null;
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    const doc = await UserModel.findByIdAndUpdate(
      id,
      {
        ...(data.name && { name: data.name }),
        ...(data.avatar && { avatar: data.avatar }),
        ...(data.email && { email: data.email }),
      },
      { new: true }
    );

    return doc ? this.toEntity(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await UserModel.findByIdAndDelete(id);
    return !!result;
  }

  async exists(clerkId: string): Promise<boolean> {
    const count = await UserModel.countDocuments({ clerkId });
    return count > 0;
  }

  private toEntity(doc: IUserDocument): User {
    return new User(
      (doc._id as any).toString(),
      doc.clerkId,
      doc.email,
      doc.name,
      doc.avatar,
      doc.emailVerified,
      doc.createdAt,
      doc.updatedAt
    );
  }
}
