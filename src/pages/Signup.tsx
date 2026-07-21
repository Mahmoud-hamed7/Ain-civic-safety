import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';
import Button from '../components/Button';
import { 
  Check, 
  Upload, 
  Camera, 
  Shield, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

export default function Signup() {
  const navigate = useNavigate();
  const { setSignupToken, signupToken, setAuth } = useAuthStore();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    displayName: '', userName: '', email: '', phoneNumber: '', ssn: '', password: '', confirmPassword: ''
  });
  const [otpCode, setOtpCode] = useState('');
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [agreed, setAgreed] = useState(false);

  const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${signupToken}` } });

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await apiClient.post('/api/account/signup-stepOne', formData);
      if (res.data.isSuccess && res.data.signupToken) {
        setSignupToken(res.data.signupToken);
        setStep(2);
      } else { setError(res.data.message || 'Failed to complete step 1.'); }
    } catch (err: any) { setError(err.response?.data?.message || 'Error connecting to server.'); }
    finally { setLoading(false); }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await apiClient.post('/api/account/verify-otp', { otpCode: otpCode.trim() }, getAuthHeader());
      if (res.data.isSuccess) {
        if (res.data.signupToken) setSignupToken(res.data.signupToken);
        setStep(3);
      } else { setError(res.data.message || 'Invalid OTP.'); }
    } catch (err: any) { setError(err.response?.data?.message || 'Verification failed.'); }
    finally { setLoading(false); }
  };

  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idFront || !idBack) { setError('Please upload both front and back of your ID.'); return; }
    setLoading(true); setError('');
    try {
      const form = new FormData();
      form.append('IDCardFront', idFront); form.append('IDCardBack', idBack);
      const res = await apiClient.post('/api/account/upload-idCard', form, { headers: { ...getAuthHeader().headers, 'Content-Type': 'multipart/form-data' } });
      if (res.data.isSuccess) {
        if (res.data.signupToken) setSignupToken(res.data.signupToken);
        setStep(4);
      } else { setError(res.data.message || 'ID Upload failed.'); }
    } catch (err: any) { setError(err.response?.data?.message || 'Upload failed.'); }
    finally { setLoading(false); }
  };

  const handleStep4Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profilePhoto) { setError('Please upload a profile photo.'); return; }
    setError(''); setStep(5);
  };

  const handleStep4AndComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) { setError('You must agree to the Terms of Service.'); return; }
    setLoading(true); setError('');
    try {
      const photoForm = new FormData();
      photoForm.append('ProfilePhoto', profilePhoto!);
      let res = await apiClient.post('/api/account/upload-profile-photo', photoForm, { headers: { ...getAuthHeader().headers, 'Content-Type': 'multipart/form-data' } });
      if (!res.data.isSuccess) throw new Error(res.data.message || 'Photo upload failed');
      
      const currentToken = res.data.signupToken || signupToken;
      if (res.data.signupToken) setSignupToken(res.data.signupToken);

      const completeRes = await apiClient.post('/api/account/complete-signup', {}, { headers: { Authorization: `Bearer ${currentToken}` } });
      const finalToken = completeRes.data.accessToken || completeRes.data.user?.token;

      if (completeRes.data.isSuccess && finalToken) {
        setAuth(completeRes.data.user, finalToken);
        navigate('/'); 
      } else { setError(completeRes.data.message || 'Failed to finalize account.'); }
    } catch (err: any) { setError(err.response?.data?.message || 'Finalization failed.'); }
    finally { setLoading(false); }
  };

  const goBack = () => { setError(''); setStep((prev) => prev - 1); };
  const stepsList = ['Basic Info', 'Verify OTP', 'ID Card', 'Photo', 'Complete'];

  return (
    <div className="min-h-screen bg-[#0B1120] flex flex-col items-center justify-center p-4 font-sans">
      <div className="flex items-center gap-3 mb-8 w-full max-w-2xl">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/30">A</div>
        <h1 className="text-2xl font-extrabold text-white tracking-wide">AIN <span className="text-gray-500 text-lg font-normal">/ Create Account</span></h1>
      </div>

      <div className="bg-[#111827] p-8 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-800">
        
        {/* Compact Stepper */}
        <div className="flex items-start justify-between mb-10 w-full px-2">
          {stepsList.map((label, index) => {
            const stepNum = index + 1;
            const isActive = step === stepNum;
            const isCompleted = step > stepNum;
            return (
              <div key={label} className="flex flex-col items-center gap-2 flex-1 relative">
                <div className="flex items-center w-full relative">
                  {stepNum !== 1 && <div className={`h-px w-full ${isCompleted ? 'bg-blue-600' : 'bg-gray-700'}`} />}
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium border-2 transition-colors shrink-0 ${isCompleted ? 'bg-blue-600 border-blue-600 text-white' : isActive ? 'border-blue-600 text-blue-500 bg-blue-600/10' : 'border-gray-700 text-gray-500 bg-transparent'}`}>
                    {isCompleted ? <Check className="w-4 h-4" /> : stepNum}
                  </div>
                  {stepNum !== stepsList.length && <div className={`h-px w-full ${isCompleted ? 'bg-blue-600' : 'bg-gray-700'}`} />}
                </div>
                <span className={`text-[10px] md:text-xs font-medium text-center ${isActive || isCompleted ? 'text-gray-300' : 'text-gray-600'}`}>{label}</span>
              </div>
            );
          })}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-xl mb-6 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</div>}

        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-5">
            <h2 className="text-2xl font-bold text-white mb-6">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <input required placeholder="Display Name" className="w-full bg-[#0B1120] border border-gray-700 rounded-lg p-3.5 text-sm text-white outline-none focus:border-blue-500" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} />
              <input required placeholder="Username" className="w-full bg-[#0B1120] border border-gray-700 rounded-lg p-3.5 text-sm text-white outline-none focus:border-blue-500" value={formData.userName} onChange={e => setFormData({...formData, userName: e.target.value})} />
            </div>
            <input required type="email" placeholder="Email Address" className="w-full bg-[#0B1120] border border-gray-700 rounded-lg p-3.5 text-sm text-white outline-none focus:border-blue-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            <input required placeholder="Phone Number" className="w-full bg-[#0B1120] border border-gray-700 rounded-lg p-3.5 text-sm text-white outline-none focus:border-blue-500" value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} />
            <input required placeholder="National ID (14 digits)" className="w-full bg-[#0B1120] border border-gray-700 rounded-lg p-3.5 text-sm text-white outline-none focus:border-blue-500" value={formData.ssn} onChange={e => setFormData({...formData, ssn: e.target.value})} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <input required type="password" placeholder="Password" className="w-full bg-[#0B1120] border border-gray-700 rounded-lg p-3.5 text-sm text-white outline-none focus:border-blue-500" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              <input required type="password" placeholder="Confirm Password" className="w-full bg-[#0B1120] border border-gray-700 rounded-lg p-3.5 text-sm text-white outline-none focus:border-blue-500" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
            </div>
            <Button className="w-full mt-6 py-4" isLoading={loading}>Continue <ArrowRight className="w-4 h-4 ml-2"/></Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleStep2} className="space-y-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Verify Phone</h2>
            <p className="text-gray-400 text-sm">Enter code sent to {formData.phoneNumber}</p>
            <input required placeholder="000000" className="w-full max-w-[200px] mx-auto bg-[#0B1120] border border-gray-700 rounded-xl p-4 text-center text-2xl tracking-[1em] text-white outline-none focus:border-blue-500" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))} maxLength={6} />
            <div className="flex gap-4"><button type="button" onClick={goBack} className="flex-1 text-gray-400 hover:text-white">Back</button><Button className="flex-[2]" isLoading={loading}>Verify</Button></div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleStep3} className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-2">Upload ID Card</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-700 rounded-2xl cursor-pointer bg-[#0B1120] hover:border-blue-500 transition-all">
                {idFront ? <Check className="w-8 h-8 text-emerald-500 mb-2"/> : <Upload className="w-8 h-8 text-gray-500 mb-2"/>}
                <span className="text-sm text-white">Front of ID</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => setIdFront(e.target.files?.[0] || null)} />
              </label>
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-700 rounded-2xl cursor-pointer bg-[#0B1120] hover:border-blue-500 transition-all">
                {idBack ? <Check className="w-8 h-8 text-emerald-500 mb-2"/> : <Upload className="w-8 h-8 text-gray-500 mb-2"/>}
                <span className="text-sm text-white">Back of ID</span>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => setIdBack(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div className="flex gap-4"><button type="button" onClick={goBack} className="flex-1 text-gray-400 hover:text-white">Back</button><Button className="flex-[2]" isLoading={loading}>Continue</Button></div>
          </form>
        )}

        {step === 4 && (
          <form onSubmit={handleStep4Next} className="space-y-6 flex flex-col items-center">
            <h2 className="text-2xl font-bold text-white">Profile Photo</h2>
            <label className="w-40 h-40 border-2 border-dashed border-gray-700 rounded-full flex items-center justify-center cursor-pointer bg-[#0B1120] hover:border-blue-500">
              {profilePhoto ? <img src={URL.createObjectURL(profilePhoto)} className="w-full h-full rounded-full object-cover" /> : <Camera className="w-10 h-10 text-gray-600" />}
              <input type="file" className="hidden" accept="image/*" onChange={(e) => setProfilePhoto(e.target.files?.[0] || null)} />
            </label>
            <div className="flex gap-4 w-full"><button type="button" onClick={goBack} className="flex-1 text-gray-400">Back</button><Button className="flex-[2]">Continue</Button></div>
          </form>
        )}

        {step === 5 && (
          <form onSubmit={handleStep4AndComplete}>
            <h2 className="text-2xl font-bold text-white mb-6">Review & Complete</h2>
            <div className="bg-[#0B1120] border border-gray-800 rounded-2xl p-6 mb-6 space-y-4">
              <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-500">Name</span><span className="text-white">{formData.displayName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="text-white">{formData.email}</span></div>
            </div>
            <label className="flex gap-3 mb-6 cursor-pointer"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="rounded bg-gray-900 border-gray-700 text-blue-500" /> <span className="text-sm text-gray-400">I agree to the Terms of Service.</span></label>
            <div className="flex gap-4"><button type="button" onClick={goBack} className="text-gray-400">Back</button><Button className="flex-[2]" isLoading={loading}><Shield className="w-4 h-4 mr-2"/> Create Account</Button></div>
          </form>
        )}
      </div>
      <p className="mt-8 text-sm text-gray-500">Already have an account? <Link to="/login" className="text-blue-500 font-medium">Sign in</Link></p>
    </div>
  );
}