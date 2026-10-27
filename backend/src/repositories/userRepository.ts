import type { Prisma, User } from '@prisma/client';
import type { Db } from '../db/client';

export class UserRepository {
  constructor(private readonly db: Db) {}

  findById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }

  findByEmail(universityEmail: string) {
    return this.db.user.findUnique({ where: { universityEmail } });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.db.user.create({ data });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.db.user.update({ where: { id }, data });
  }
}
