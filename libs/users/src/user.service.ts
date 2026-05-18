import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { UserRepository } from './user.repository.js';
import { UserEntity } from './user.entity.js';

export interface UpsertUserInput {
  azureOid: string;
  email: string;
  displayName: string;
}

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async upsertFromAzure(input: UpsertUserInput): Promise<UserEntity> {
    return this.userRepository.upsert(input);
  }

  async findById(id: number): Promise<UserEntity> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: `User ${id} not found` });
    }
    return user;
  }

  async updateDisplayName(id: number, displayName: string): Promise<UserEntity> {
    const trimmed = displayName.trim();
    if (trimmed.length < 1 || trimmed.length > 255) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'displayName must be between 1 and 255 characters',
      });
    }
    return this.userRepository.updateDisplayName(id, trimmed);
  }
}
