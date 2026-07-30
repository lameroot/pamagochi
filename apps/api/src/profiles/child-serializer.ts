import { Injectable } from '@nestjs/common';
import type { ChildProfileDto } from '@pamagochi/contracts';
import type { ChildProfile } from '@pamagochi/database';

export function serializeChild(child: ChildProfile): ChildProfileDto {
  return {
    id: child.id,
    parentId: child.parentId,
    displayName: child.displayName,
    avatarKey: child.avatarKey,
    birthYear: child.birthYear,
    birthDate: child.birthDate?.toISOString().slice(0, 10) ?? null,
    primaryLanguage: child.primaryLanguage,
    readingLevel: child.readingLevel,
    mathLevel: child.mathLevel,
    deletedAt: child.deletedAt?.toISOString() ?? null,
    createdAt: child.createdAt.toISOString(),
    updatedAt: child.updatedAt.toISOString(),
  };
}

@Injectable()
export class ChildSerializerService {
  serialize(child: ChildProfile): ChildProfileDto {
    return serializeChild(child);
  }
}
