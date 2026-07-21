import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next'; // 👈 الترجمة
import apiClient from '../../api/client';
import Skeleton from '../../components/Skeleton';
import ReportMap from '../../components/Map/ReportMap';
import type { Report } from '../../types';
import { getStatusPinColor } from '../../utils/map';

export default function ReportDetail() {
  const { t, i18n } = useTranslation(); // 👈
  const { id } = useParams();

  const { data, isLoading } = useQuery<Report>({
    queryKey: ['reports', id],
    queryFn: async () => {
      const res = await apiClient.get(`/api/reports/${id}`);
      return res.data;
    }
  });

  if (isLoading) return <Skeleton type="card" className="max-w-4xl mx-auto mt-6" />;
  if (!data) return <div className="text-white text-center mt-10">{t('report_detail.not_found', 'Report not found')}</div>;

  // تنسيق التاريخ بناءً على لغة اليوزر الحالية
  const formattedDate = new Date(data.createdAt).toLocaleDateString(i18n.language.startsWith('ar') ? 'ar-EG' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-bold text-white">{data.title}</h1>
          <span 
            className="px-3 py-1 text-sm font-bold rounded-full text-white"
            style={{ backgroundColor: getStatusPinColor(data.status) }}
          >
            {/* ترجمة الـ Status */}
            {t(`status.${data.status}`, data.status)}
          </span>
        </div>
        
        <div className="flex gap-4 mb-6 text-sm text-gray-400">
          <span className="bg-gray-900 px-3 py-1 rounded-lg border border-gray-700">{data.category}</span>
          <span className="bg-gray-900 px-3 py-1 rounded-lg border border-gray-700">{data.visibility}</span>
          <span className="px-3 py-1">{formattedDate}</span>
        </div>

        <p className="text-gray-300 whitespace-pre-wrap mb-8 text-start">{data.description}</p>
        
        <h3 className="text-lg font-bold text-white mb-4">{t('report_detail.location', 'Location')}</h3>
        <ReportMap lat={data.location.latitude} lng={data.location.longitude} status={data.status} />
      </div>
    </div>
  );
}