import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next'; // 👈 الترجمة
import { Search, Globe2, ArrowLeft, MapPin } from 'lucide-react';
import { communityApi } from '../../api/community';
import { communityKeys } from '../../queryKeys';
import { extractCommunityApiError } from '../../utils/communityErrors';
import SearchResultCard from '../../components/Community/citizen/SearchResultCard';
import NearbyCommunityCard from '../../components/Community/citizen/NearbyCommunityCard';
import InviteCodeJoinPanel from '../../components/Community/citizen/InviteCodeJoinPanel';
import Skeleton from '../../components/Skeleton';
import { useNotificationStore } from '../../store/notificationStore';
import { useSignalR } from '../../providers/SignalRProvider';
import type { JoinCommunityResponse } from '../../types';

export default function DiscoverCommunities() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');

  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addToast = useNotificationStore((s) => s.addToast);
  const { joinCommunityGroup } = useSignalR();

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [typeFilter, setTypeFilter] = useState<'all' | 0 | 1>('all');
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [joinResult, setJoinResult] = useState<JoinCommunityResponse | null>(null);
  const [nearbyRadius, setNearbyRadius] = useState(1);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = searchParams.get('search');
    if (q) setSearch(q);
  }, [searchParams]);

  const searchParams_ = { name: search || undefined, type: typeFilter === 'all' ? undefined : typeFilter };
  const { data: searchResults = [], isLoading } = useQuery({
    queryKey: communityKeys.search(searchParams_),
    queryFn: () => communityApi.search(searchParams_),
  });

  const { data: nearbyCommunities = [], isLoading: nearbyLoading } = useQuery({
    queryKey: communityKeys.nearby(nearbyRadius),
    queryFn: () => communityApi.getNearby(nearbyRadius),
  });

  const refetchMy = () => qc.invalidateQueries({ queryKey: communityKeys.myList() });

  const { mutate: joinByCode, isPending: joiningCode } = useMutation({
    mutationFn: () => communityApi.joinByInviteCode(inviteCode),
    onSuccess: (res) => {
      setJoinResult(res);
      setInviteCode('');
      refetchMy();
      joinCommunityGroup(res.communityId);
      if (res.requiresLocation) {
        addToast({
          type: 'warning',
          title: res.message || `Joined "${res.communityName}"`,
          description: 'Please share your location to activate SOS.',
        });
      } else {
        addToast({ type: 'success', title: res.message || `Joined "${res.communityName}"!` });
      }
      navigate(`/citizen/communities/${res.communityId}`);
    },
    onError: (error) =>
      addToast({
        type: 'error',
        title: 'Invalid code',
        description: extractCommunityApiError(error),
      }),
  });

  const { mutate: submitJoinRequest } = useMutation({
    mutationFn: (communityId: string) => communityApi.submitJoinRequest(communityId),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Join request submitted', description: 'Waiting for admin approval.' });
      setRequestingId(null);
    },
    onError: (error) => {
      addToast({ type: 'error', title: 'Request failed', description: extractCommunityApiError(error) });
      setRequestingId(null);
    },
  });

  function focusInviteCode() {
    document.getElementById('invite-code-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    codeInputRef.current?.focus();
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/citizen/communities" className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white">
          <ArrowLeft className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{t('discover_communities.title', 'Discover Communities')}</h1>
          <p className="text-sm text-gray-500">{t('discover_communities.subtitle', 'Browse nearby neighborhoods, search, or join with an invite code')}</p>
        </div>
      </div>

      <InviteCodeJoinPanel
        ref={codeInputRef}
        inviteCode={inviteCode}
        onChange={setInviteCode}
        onJoin={() => joinByCode()}
        joining={joiningCode}
        joinResult={joinResult}
      />

      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">{t('discover_communities.nearby', 'Nearby Communities')}</h2>
            <span className="text-xs text-gray-500">{t('discover_communities.based_on_location', 'Based on your profile location')}</span>
          </div>
          <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1 flex-row-reverse sm:flex-row">
            {([1, 3, 5] as const).map((km) => (
              <button
                key={km}
                type="button"
                onClick={() => setNearbyRadius(km)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  nearbyRadius === km ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {km}km
              </button>
            ))}
          </div>
        </div>
        {nearbyLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} type="card" className="h-36" />
            ))}
          </div>
        ) : nearbyCommunities.length === 0 ? (
          <p className="text-xs text-gray-600 py-4 text-center border border-dashed border-gray-800 rounded-xl">
            {t('discover_communities.no_nearby', 'No communities found within {{km}}km. Set your location in Profile to see nearby groups.').replace('{{km}}', String(nearbyRadius))}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {nearbyCommunities.map((c) => (
              <NearbyCommunityCard key={c.id} community={c} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Search className="w-4 h-4 text-indigo-400" /> {t('discover_communities.search_title', 'Search Communities')}
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-2.5 w-4 h-4 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('discover_communities.search_placeholder', 'Search by name…')}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl ps-9 pe-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
            {[
              ['all', t('discover_communities.filter_all', 'All')], 
              [0, t('discover_communities.filter_neighborhood', 'Neighborhood')], 
              [1, t('discover_communities.filter_building', 'Building')]
            ].map(([val, label]) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => setTypeFilter(val as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                  typeFilter === val ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} type="card" className="h-48" />
            ))}
          </div>
        ) : searchResults.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Globe2 className="w-12 h-12 text-gray-700 mb-3" />
            <p className="text-gray-400 font-semibold">{t('discover_communities.no_results', 'No communities found.')}</p>
            <p className="text-xs text-gray-600 mt-1">{t('discover_communities.private_notice', 'Private groups are invite-only — use an invite code above.')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {searchResults.map((c) => (
              <SearchResultCard
                key={c.id}
                community={c}
                isRequesting={requestingId === c.id}
                onJoinRequest={(id) => {
                  setRequestingId(id);
                  submitJoinRequest(id);
                }}
                onFocusInviteCode={focusInviteCode}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}