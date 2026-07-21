import { useTranslation } from 'react-i18next'; // 👈 استدعاء الترجمة
import CombinedMap from '../../components/Map/CombinedMap';

export default function AuthorityMap() {
  const { t } = useTranslation(); // 👈 تفعيل الترجمة

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* ضفنا text-start عشان يظبط المحاذاة في العربي */}
      <div className="shrink-0 px-5 py-3 bg-gray-900 border-b border-gray-800 flex items-center gap-3 text-start">
        <h1 className="text-lg font-bold text-white">
          {t('authority_map.title', 'Territory Map')}
        </h1>
        <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
          {t('authority_map.subtitle', 'Reports, SOS & coverage')}
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <CombinedMap viewerRole="authority" showFilterPanel height="100%" />
      </div>
    </div>
  );
}