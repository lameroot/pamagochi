import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  type ChildAvatarKey,
  type CreateChildProfileRequest,
  listChildProfilesResponseSchema,
  childProfileSchema,
} from '@pamagochi/contracts';
import { Button, ErrorState, LoadingState } from '@pamagochi/ui';
import type { ApiClient } from '../lib/api-client.js';

const AVATARS: ChildAvatarKey[] = ['fox', 'owl', 'panda', 'dragon'];

export interface ChildrenPanelProps {
  apiClient: ApiClient;
  onSelectActiveChild: (name: string) => void;
}

export function ChildrenPanel({
  apiClient,
  onSelectActiveChild,
}: ChildrenPanelProps): React.JSX.Element {
  const [displayName, setDisplayName] = useState('');
  const [avatarKey, setAvatarKey] = useState<ChildAvatarKey>('fox');
  const queryClient = useQueryClient();

  const childrenQuery = useQuery({
    queryKey: ['children'],
    queryFn: () => apiClient.request('/api/children', listChildProfilesResponseSchema),
  });

  const createChild = useMutation({
    mutationFn: (body: CreateChildProfileRequest) =>
      apiClient.request('/api/children', childProfileSchema, { method: 'POST', body }),
    onSuccess: async () => {
      setDisplayName('');
      await queryClient.invalidateQueries({ queryKey: ['children'] });
    },
  });

  if (childrenQuery.isPending) return <LoadingState label="Загружаем детские профили…" />;
  if (childrenQuery.isError) {
    return <ErrorState message="Не удалось загрузить детские профили" />;
  }

  return (
    <div>
      <h2>Детские профили</h2>
      <ul data-testid="children-list">
        {childrenQuery.data.children.map((child) => (
          <li key={child.id}>
            <button type="button" onClick={() => onSelectActiveChild(child.displayName)}>
              {child.displayName} ({child.avatarKey})
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!displayName.trim()) return;
          createChild.mutate({ displayName: displayName.trim(), avatarKey });
        }}
      >
        <input
          aria-label="Имя ребёнка"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Имя ребёнка"
        />
        <select
          value={avatarKey}
          onChange={(event) => setAvatarKey(event.target.value as ChildAvatarKey)}
        >
          {AVATARS.map((avatar) => (
            <option key={avatar} value={avatar}>
              {avatar}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={createChild.isPending}>
          Добавить профиль
        </Button>
      </form>

      {createChild.isError ? <ErrorState message="Не удалось создать профиль" /> : null}
    </div>
  );
}
