import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // 👈 الترجمة
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import apiClient from '../../api/client';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { useNotificationStore } from '../../store/notificationStore';

export default function NewReport() {
  const { t } = useTranslation(); // 👈 تفعيل الترجمة
  const [step, setStep] = useState(1);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [selectedCategoryId,    setSelectedCategoryId]    = useState('');
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState('');
  const navigate = useNavigate();
  const addToast = useNotificationStore((state) => state.addToast);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn:  () => apiClient.get('/api/categories').then(
      (r) => r.data as Array<{ id: string; name: string; subCategories: Array<{ id: string; name: string }> }>
    ),
    staleTime: Infinity,
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  const nextStep = () => setStep((p) => p + 1);
  const prevStep = () => setStep((p) => p - 1);

  const onSubmit = async (data: any) => {
    if (!location) {
      addToast({ type: 'error', title: 'Location required', description: 'Please select a location on the map.' });
      return;
    }

    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('visibility', data.visibility);
    formData.append('subCategoryId', selectedSubCategoryId);
    formData.append('latitude', location.lat.toString());
    formData.append('longitude', location.lng.toString());
    
    files.forEach((file) => formData.append('attachments', file));

    try {
      await apiClient.post('/api/reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      addToast({ type: 'success', title: 'Report Submitted', description: 'Your report has been successfully submitted.' });
      navigate('/citizen/my-reports');
    } catch (error) {
      addToast({ type: 'error', title: 'Submission failed', description: 'Please try again later.' });
    }
  };

  function LocationPicker() {
    useMapEvents({ click(e) { setLocation(e.latlng); } });
    return location ? <Marker position={location} /> : null;
  }

  const handleGeolocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-8">{t('new_report.title', 'Submit New Report')}</h1>
      
      <div className="flex mb-8 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`h-2 flex-1 rounded ${step >= i ? 'bg-indigo-500' : 'bg-gray-700'}`} />
        ))}
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
          
          {step === 1 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <h2 className="text-xl font-bold text-white">{t('new_report.step1', 'Step 1: Basic Info')}</h2>
              <Input label={t('new_report.report_title', 'Title')} {...register('title', { required: true })} error={errors.title ? t('new_report.required', 'Required') : ""} />
              
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-300">{t('new_report.description', 'Description')}</label>
                <textarea 
                  {...register('description', { required: true })} 
                  className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-white h-32 focus:border-indigo-500 outline-none resize-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-300">{t('new_report.visibility', 'Visibility')}</label>
                <select {...register('visibility')} className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-indigo-500">
                  <option value="Public">{t('new_report.public', 'Public')}</option>
                  <option value="Confidential">{t('new_report.confidential', 'Confidential')}</option>
                  <option value="Anonymous">{t('new_report.anonymous', 'Anonymous')}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-300">{t('new_report.category', 'Category')}</label>
                {categoriesLoading ? (
                  <div className="h-12 bg-gray-900 border border-gray-700 rounded-xl animate-pulse" />
                ) : (
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => { setSelectedCategoryId(e.target.value); setSelectedSubCategoryId(''); }}
                    className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-indigo-500"
                  >
                    <option value="">{t('new_report.select_category', 'Select a category…')}</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {selectedCategoryId && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-300">{t('new_report.sub_category', 'Sub-category')}</label>
                  <select
                    value={selectedSubCategoryId}
                    onChange={(e) => setSelectedSubCategoryId(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-indigo-500"
                  >
                    <option value="">{t('new_report.select_sub_category', 'Select a sub-category…')}</option>
                    {(categories.find((c) => c.id === selectedCategoryId)?.subCategories ?? []).map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <Button type="button" onClick={nextStep} disabled={!selectedSubCategoryId} className="mt-4">{t('new_report.next_location', 'Next: Location')}</Button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">{t('new_report.step2', 'Step 2: Location')}</h2>
                <Button type="button" variant="outline" size="sm" onClick={handleGeolocation}>{t('new_report.use_my_location', 'Use My Location')}</Button>
              </div>
              <p className="text-sm text-gray-400">{t('new_report.click_map', 'Click on the map to pin the exact location.')}</p>
              
              <div className="h-[400px] w-full rounded-xl border border-gray-700 overflow-hidden">
                <MapContainer center={[30.0444, 31.2357]} zoom={12} className="h-full w-full z-0">
                  <TileLayer url={import.meta.env.VITE_MAP_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"} />
                  <LocationPicker />
                </MapContainer>
              </div>
              
              <div className="flex gap-4 mt-4">
                <Button type="button" variant="secondary" onClick={prevStep} className="w-full">{t('new_report.back', 'Back')}</Button>
                <Button type="button" onClick={nextStep} className="w-full">{t('new_report.next_attachments', 'Next: Attachments')}</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <h2 className="text-xl font-bold text-white">{t('new_report.step3', 'Step 3: Attachments')}</h2>
              <p className="text-sm text-gray-400">{t('new_report.upload_desc', 'Upload images or videos (max 10 files).')}</p>
              
              <div className="border-2 border-dashed border-gray-600 rounded-xl p-10 text-center hover:border-indigo-500 transition-colors">
                <input 
                  type="file" 
                  multiple 
                  onChange={(e) => setFiles(Array.from(e.target.files || []))} 
                  className="hidden" 
                  id="file-upload" 
                />
                <label htmlFor="file-upload" className="cursor-pointer text-indigo-500 font-medium">
                  {t('new_report.browse_files', 'Click to browse files')}
                </label>
                <p className="text-gray-500 text-sm mt-2">
                  {files.length > 0 ? t('new_report.files_selected', '{{count}} files selected').replace('{{count}}', String(files.length)) : t('new_report.no_files', 'No files selected')}
                </p>
              </div>
              
              <div className="flex gap-4 mt-4">
                <Button type="button" variant="secondary" onClick={prevStep} className="w-full">{t('new_report.back', 'Back')}</Button>
                <Button type="submit" isLoading={isSubmitting} className="w-full">{t('new_report.submit', 'Submit Report')}</Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}