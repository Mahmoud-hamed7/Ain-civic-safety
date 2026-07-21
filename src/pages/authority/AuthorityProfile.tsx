import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next'; // 👈 الترجمة
import { Info, Phone, Mail, User, MapPin, Award, Building2 } from 'lucide-react';
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import type { Authority } from '../../types';
import CoverageAreaMap from '../../components/Map/CoverageAreaMap';

export default function AuthorityProfile() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const { data, isLoading } = useQuery<Authority>({
    queryKey: ['authorities', 'me'],
    queryFn:  async () => (await apiClient.get('/api/authorities/me')).data,
  });

  if (isLoading) return <Skeleton type="card" className="max-w-4xl mx-auto mt-6 h-96" />;
  if (!data) return <div className="text-white text-center mt-10">{t('authority_profile.not_found', 'Profile not found.')}</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-start">
      <h1 className="text-2xl font-bold text-white">{t('authority_profile.title', 'Authority Profile')}</h1>

      {/* Read-only banner */}
      <div className="flex items-center gap-3 bg-blue-950/40 border border-blue-800/40 text-blue-300 text-sm p-4 rounded-xl">
        <Info className="w-5 h-5 shrink-0 text-blue-400" />
        {t('authority_profile.info_banner', 'Authority profiles are managed centrally. Contact a System Administrator to update your details or coverage area.')}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Info card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
          {/* Name + type */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-900/30 border border-blue-800/40 flex items-center justify-center shrink-0">
              <Building2 className="w-7 h-7 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{data.name}</h2>
              {data.type && <p className="text-sm text-gray-400 mt-0.5">{data.type}</p>}
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${data.status === 1 ? 'text-emerald-400 bg-emerald-900/20 border border-emerald-800/30' : 'text-gray-400 bg-gray-800 border border-gray-700'}`}>
                {data.status === 1 ? t('authority_profile.active', 'Active') : t('authority_profile.inactive', 'Inactive')}
              </span>
            </div>
          </div>

          {/* Contact details */}
          <div className="space-y-3 text-sm">
            {data.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="text-gray-300" dir="ltr">{data.phone}</span>
              </div>
            )}
            {data.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="text-gray-300">{data.email}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-gray-500 shrink-0" />
              <span className="text-gray-300 font-mono text-xs" dir="ltr">
                {data.latitude?.toFixed(4)}, {data.longitude?.toFixed(4)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Award className="w-4 h-4 text-gray-500 shrink-0" />
              <span className="text-gray-300">
                {t('authority_profile.jurisdiction', 'Jurisdiction:')} <span className="text-white font-semibold" dir="ltr">{data.jurisdictionRadiusKm} km</span>
              </span>
            </div>
          </div>

          {/* Linked user account */}
          {data.userId && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">
                {t('authority_profile.linked_account', 'Linked User Account')}
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-900/40 border border-blue-800/40 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-sm">
                  <p className="text-white font-medium">{t('authority_profile.account_linked', 'Account linked')}</p>
                  <p className="text-gray-500 font-mono text-xs break-all text-start" dir="ltr">{data.userId}</p>
                </div>
              </div>
            </div>
          )}

          {/* Specializations */}
          {data.specializations?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">{t('authority_profile.specializations', 'Specializations')}</p>
              <div className="flex flex-wrap gap-2">
                {data.specializations.map((spec) => (
                  <span
                    key={spec.id}
                    className="flex items-center gap-1.5 px-3 py-1 bg-blue-900/20 text-blue-300 border border-blue-800/40 rounded-full text-xs font-semibold"
                  >
                    {spec.icon && <span>{spec.icon}</span>}
                    {spec.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Coverage map */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">{t('authority_profile.coverage_area', 'Coverage Area')}</h3>
            {data.jurisdictionRadiusKm && (
              <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full" dir="ltr">
                {t('authority_profile.radius', 'Radius:')} {data.jurisdictionRadiusKm} km
              </span>
            )}
          </div>
            <CoverageAreaMap authority={data} height="320px" />

          {/* Coverage areas list */}
          {data.coverageAreas?.length > 0 && (
            <div className="space-y-2">
              {data.coverageAreas.map((area) => (
                <div key={area.id} className="flex items-center justify-between text-sm bg-gray-800/50 rounded-lg px-3 py-2">
                  <span className="text-gray-200 font-medium">{area.areaName}</span>
                  <span className="text-gray-500 text-xs" dir="ltr">{area.radiusKm} km</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}