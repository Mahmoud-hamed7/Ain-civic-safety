import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuthStore } from "../store/authStore";
import apiClient from "../api/client";
import Button from "../components/Button";
import {
  Siren,
  ClipboardList,
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormInputs = z.infer<typeof loginSchema>;

const FEATURES = [
  { icon: Siren, color: "text-red-400 bg-red-500/20", title: "Emergency SOS", desc: "Real-time location sharing with communities" },
  { icon: ClipboardList, color: "text-amber-400 bg-amber-500/20", title: "Civic Reports", desc: "Submit and track local issues transparently" },
  { icon: Building2, color: "text-blue-400 bg-blue-500/20", title: "Authority Response", desc: "Direct channel to government authorities" },
];

const DEMO_ACCOUNTS = {
  citizen: { email: "ahmedool66@gmail.com", password: "Mahmoud123@" },
  authority: { email: "authority@ain.com", password: "password123" },
  admin: { email: "admin@ain.com", password: "Pa$$w0rd123!" },
};

export default function Login() {
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, setError } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const onSubmit = async (data: LoginFormInputs) => {
    setLoading(true);
    try {
      const response = await apiClient.post("/api/account/login", data);
      const token = response.data.accessToken || response.data.user?.token || response.data.token;
      await login(token);

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userRole = payload.role || payload.roles || payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
        const isRole = (r: string) => Array.isArray(userRole) ? userRole.includes(r) : userRole === r;

        if (isRole('SuperAdmin') || isRole('Admin')) navigate("/admin/dashboard");
        else if (isRole('Authority')) navigate("/authority/dashboard");
        else navigate("/citizen/feed");
      } catch {
        navigate("/");
      }
    } catch {
      setLoading(false);
      setError("root", { message: "Invalid email or password" });
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-900 font-sans" dir="ltr">
      
      {/* Left Side: Branding */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-slate-800 to-slate-950 flex-col items-center justify-center p-12 border-r border-gray-800">
        <div className="max-w-md w-full space-y-12">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold shadow-lg shadow-blue-900/50">A</div>
            <div>
              <h1 className="text-4xl font-extrabold text-white tracking-wider">AIN</h1>
              <p className="text-gray-400 text-sm mt-1 font-medium font-arabic">عين</p>
            </div>
            <p className="text-gray-400 text-center max-w-sm">Civic reporting & community safety platform for a safer tomorrow</p>
          </div>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, color, title, desc }, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
                <div className={`p-3 rounded-xl shrink-0 ${color}`}><Icon className="w-6 h-6" /></div>
                <div className="text-left">
                  <h3 className="text-white font-semibold">{title}</h3>
                  <p className="text-sm text-gray-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 text-left">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-gray-400">Sign in to your account to continue</p>
          </div>

          {/* Demo Accounts Display Box (Compact & Small) */}
          <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-3.5 space-y-2.5">
            <h2 className="text-xs font-bold text-blue-400 tracking-wide border-b border-gray-700/50 pb-1.5 uppercase">
              Demo Accounts:
            </h2>
            <div className="space-y-2">
              {(["citizen", "authority", "admin"] as const).map((role) => {
                const acc = DEMO_ACCOUNTS[role];
                const isCopied = copiedKey === role;
                return (
                  <div key={role} className="bg-gray-900/70 border border-gray-800/80 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider block">{role}</span>
                      <h2 className="text-xs font-mono text-white select-all">{acc.email}</h2>
                      <h2 className="text-[11px] font-mono text-gray-400 select-all">Pass: {acc.password}</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(`Email: ${acc.email}\nPassword: ${acc.password}`, role)}
                      className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md transition-colors flex items-center gap-1 text-[11px] font-medium shrink-0"
                    >
                      {isCopied ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied</span></> : <><Copy className="w-3 h-3" /><span>Copy</span></>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block text-left">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="email" placeholder="ahmed@example.com" {...register("email")} className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors text-left" />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1 text-left">{errors.email.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block text-left">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type={showPassword ? "text" : "password"} placeholder="••••••••" {...register("password")} className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-9 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors text-left tracking-widest" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 outline-none">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1 text-left">{errors.password.message}</p>}
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-blue-500/20" />
                <span className="text-gray-400 group-hover:text-gray-300">Remember me</span>
              </label>
              <a href="#" className="text-blue-500 hover:text-blue-400 font-medium">Forgot password?</a>
            </div>

            {errors.root && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-2.5 rounded-lg text-center">{errors.root.message}</div>
            )}

            <Button type="submit" isLoading={loading} className="w-full py-2.5 text-base flex justify-center items-center gap-2">
              Sign in <span>→</span>
            </Button>
          </form>

          <p className="text-center text-sm text-gray-400 pt-2">
            Don't have an account? <Link to="/signup" className="text-blue-500 hover:text-blue-400 font-medium">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}