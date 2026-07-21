export const communityKeys = {
  all: ['communities'] as const,
  my: () => [...communityKeys.all, 'my'] as const,
  myList: () => [...communityKeys.all, 'my-list'] as const,
  list: (params?: object) =>
    params ? ([...communityKeys.all, 'list', params] as const) : ([...communityKeys.all, 'list'] as const),
  detail: (id: string) => [...communityKeys.all, 'detail', id] as const,
  members: (id: string) => [...communityKeys.all, id, 'members'] as const,
  joinRequests: (id: string) => [...communityKeys.all, id, 'join-requests'] as const,
  search: (params: object) => [...communityKeys.all, 'search', params] as const,
  nearby: (radius: number) => [...communityKeys.all, 'nearby', radius] as const,
};
