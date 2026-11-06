import { Inject, Injectable } from '@nestjs/common';
import { defined } from '../../common/utils/defined';
import { Errors } from '../../common/errors';
import { REPO, type UsersRepository } from '../../database/repositories';
import type { Profile } from '../../domain/types';
import type { UpdateProfileDto } from './users.dto';

export interface PublicUser { id: string; email: string; createdAt: string; signIn: { password: boolean; google: boolean }; profile: Omit<Profile, 'userId'> }

@Injectable()
export class UsersService {
  constructor(@Inject(REPO.users) private readonly users: UsersRepository) {}

  /** The safe view of a user — never includes the password hash. */
  async me(userId: string): Promise<PublicUser> {
    const u = await this.users.findById(userId);
    const p = await this.users.getProfile(userId);
    if (!u || !p) throw Errors.notFound('User');
    const { userId: _omit, ...profile } = p;
    return { id: u.id, email: u.email, createdAt: u.createdAt, signIn: { password: !!u.passwordHash, google: !!u.googleSub }, profile };
  }

  async profile(userId: string) { return (await this.users.getProfile(userId)) ?? null; }

  async update(userId: string, dto: UpdateProfileDto) {
    if (!(await this.users.findById(userId))) throw Errors.notFound('User');
    await this.users.updateProfile(userId, defined(dto));
    return this.me(userId);
  }
}
