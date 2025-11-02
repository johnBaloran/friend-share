export class User {
  constructor(
    public readonly id: string,
    public readonly clerkId: string,
    public readonly email: string,
    public readonly name?: string,
    public readonly avatar?: string,
    public readonly emailVerified?: Date,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {}

  static create(data: {
    clerkId: string;
    email: string;
    name?: string;
    avatar?: string;
    emailVerified?: Date;
  }): User {
    return new User(
      '', // ID will be assigned by repository
      data.clerkId,
      data.email,
      data.name,
      data.avatar,
      data.emailVerified
    );
  }

  update(data: { name?: string; avatar?: string }): User {
    return new User(
      this.id,
      this.clerkId,
      this.email,
      data.name ?? this.name,
      data.avatar ?? this.avatar,
      this.emailVerified,
      this.createdAt,
      new Date()
    );
  }
}
