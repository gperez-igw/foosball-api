import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity.js';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async findByAzureOid(azureOid: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { azureOid } });
  }

  async findById(id: number): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async upsert(data: {
    azureOid: string;
    email: string;
    displayName: string;
    isAdmin: boolean;
  }): Promise<UserEntity> {
    const existing = await this.findByAzureOid(data.azureOid);

    if (existing) {
      existing.email = data.email;
      existing.displayName = data.displayName;
      existing.isAdmin = data.isAdmin;
      return this.repo.save(existing);
    }

    const user = this.repo.create({
      azureOid: data.azureOid,
      email: data.email,
      displayName: data.displayName,
      isAdmin: data.isAdmin,
    });
    return this.repo.save(user);
  }

  async updateDisplayName(id: number, displayName: string): Promise<UserEntity> {
    await this.repo.update(id, { displayName });
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`User ${id} not found after update`);
    }
    return updated;
  }
}
