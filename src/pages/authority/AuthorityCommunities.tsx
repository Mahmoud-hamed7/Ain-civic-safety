import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, ChevronLeft, ChevronRight, Users, Info, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { communityApi } from '../../api/community';
import { communityKeys } from '../../queryKeys';
import { parseCommunityAdminResponse, isNeighborhoodCommunity } from '../../utils/communities';
import CommunityTypeBadge from '../../components/Community/CommunityTypeBadge';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import type { CommunityType } from '../../types';

export default function AuthorityCommunities() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<CommunityType | 'all'>('all');
  const PAGE_SIZE = 20;

  const TYPE_FILTERS: { label: string; value: CommunityType | 'all' }[] = [
    { label: t('authority_communities.all_types', 'All'), value: 'all' },
    { label: t('authority_communities.neighborhood', 'Neighborhood'), value: 0 },
    { label: t('authority_communities.building', 'Building'), value: 1 },
    { label: t('authority_communities.private_group', 'Private Group'), value: 2 },
  ];

  const listParams = { page, search, typeFilter };
  
  const { data, isLoading } = useQuery({
    queryKey: communityKeys.list(listParams),
    queryFn: async () => {
      // بنجيب الـ Response كـ any عشان TypeScript ميقيدناش في التعديل
      const res: any = await communityApi.getAll({
        pageNumber: page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        communityType: typeFilter !== 'all' ? typeFilter : undefined,
      });

      // ✅ التعديل لحل الـ TS Error وقراءة الداتا صح من الباك إند
      // لو الباك إند باعت الداتا في items ومفيش communities، هننسخها
      if (res.items && !res.communities) {
        res.communities = res.items;
      }
      
      return parseCommunityAdminResponse(res);
    },
  });

  // هنا بنقرا الـ communities عادي لأن الـ parser خلاص اتأكد إنها موجودة
  const communities = data?.communities ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-start">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('authority_communities.title', 'Communities')}</h1>
        {!isLoading && (
          <p className="text-sm text-gray-500 mt-0.5">
            {t('authority_communities.subtitle', '{{count}} communities in your jurisdiction').replace('{{count}}', String(totalCount))}
          </p>
        )}
      </div>

      <div className="flex items-start gap-3 bg-blue-950/30 border border-blue-800/30 text-blue-300 text-sm p-4 rounded-xl">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
        <span>{t('authority_communities.info_banner', 'Read-only view of communities in your coverage area. Manage join requests from the community detail page.')}</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-2.5 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('authority_communities.search', 'Search by name…')}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl ps-9 pe-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 text-start"
          />
        </div>
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
          {TYPE_FILTERS.map(({ label, value }) => (
            <button
              key={String(value)}
              onClick={() => { setTypeFilter(value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                typeFilter === value ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} type="table-row" />)}</div>
      ) : communities.length === 0 ? (
        <EmptyState 
          title={t('authority_communities.no_communities_title', 'No Communities Found')} 
          message={t('authority_communities.no_communities_msg', 'There are no communities with members in your jurisdiction yet.')} 
        />
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-start">
              <thead>
                <tr className="bg-gray-800/60 border-b border-gray-800">
                  {[
                    t('authority_communities.table_name', 'Name'),
                    t('authority_communities.table_type', 'Type'),
                    t('authority_communities.table_members', 'Members'),
                    t('authority_communities.table_requests', 'Join Requests'),
                    t('authority_communities.table_creator', 'Creator'),
                    t('authority_communities.table_created', 'Created')
                  ].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-start text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {communities.map((c: any) => {
                  const pending = c.pendingJoinRequestCount ?? 0;
                  const showJoinRequests = isNeighborhoodCommunity(c.communityType) && pending > 0;
                  return (
                    <tr key={c.id} className="hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-start">
                        <Link to={`/authority/communities/${c.id}`} className="font-semibold text-white hover:text-indigo-300">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-start"><CommunityTypeBadge type={c.communityType} /></td>
                      <td className="px-4 py-3 text-start">
                        <span className="flex items-center gap-1.5 text-white font-semibold">
                          <Users className="w-4 h-4 text-indigo-400" /> {c.memberCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-start">
                        {showJoinRequests ? (
                          <Link
                            to={`/authority/communities/${c.id}?tab=join-requests`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full hover:bg-amber-400/20"
                          >
                            <UserPlus className="w-3 h-3" /> {pending} {t('authority_communities.pending', 'pending')}
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 text-start">{c.createdByName}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap text-start" dir="ltr">
                        {c.createdAt ? format(new Date(c.createdAt), 'MMM d, yyyy') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white disabled:opacity-40"
          >
            {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />} {t('authority_communities.previous', 'Previous')}
          </button>
          <span className="text-sm text-gray-400">
            {t('authority_communities.page', 'Page {{current}} of {{total}}').replace('{{current}}', String(page)).replace('{{total}}', String(totalPages))}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white disabled:opacity-40"
          >
            {t('authority_communities.next', 'Next')} {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}