import { useTranslation } from 'react-i18next';
import CombinedMap from '../../components/Map/CombinedMap';

export default function AdminMap() {
  const { t } = useTranslation();

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <div className="shrink-0 px-6 py-4 bg-gray-950 border-b border-gray-800 flex items-center gap-3 text-start">
        <div>
          <h1 className="text-xl font-bold text-white">
            {t('admin_map.title', 'خريطة النظام الشاملة')}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            <span className="bg-gray-800 px-3 py-1 rounded-full border border-gray-700 inline-block">
              {t('admin_map.subtitle', 'كل البلاغات وحالات طوارئ SOS النشطة')}
            </span>
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <CombinedMap viewerRole="admin" showFilterPanel height="100%" />
      </div>
    </div>
  );
}