import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import GuestRoute from './guards/GuestRoute';
import ProtectedRoute from './guards/ProtectedRoute';
import RoleGuard from './guards/RoleGuard';

import Login from '../pages/Login';
import Signup from '../pages/Signup';
import DevLogin from '../pages/DevLogin';

import CitizenLayout from '../layouts/CitizenLayout';
import CitizenFeed from '../pages/citizen/CitizenFeed';
import CitizenMap from '../pages/citizen/CitizenMap';
import MyReports from '../pages/citizen/MyReports';
import NewReport from '../pages/citizen/NewReport';
import ReportDetail from '../pages/citizen/ReportDetail';
import SOS from '../pages/citizen/SOS';
import Communities from '../pages/citizen/Communities';
import CitizenCommunityDetail from '../pages/citizen/CitizenCommunityDetail';
import CreateCommunityPage from '../pages/citizen/CreateCommunityPage';
import DiscoverCommunities from '../pages/citizen/DiscoverCommunities';
import EditCommunityPage from '../pages/citizen/EditCommunityPage';
import Profile from '../pages/citizen/Profile';

import AuthorityLayout from '../layouts/AuthorityLayout';
import AuthorityDashboard from '../pages/authority/AuthorityDashboard';
import AuthorityFeed from '../pages/authority/AuthorityFeed';
import AuthorityReportDetail from '../pages/authority/AuthorityReportDetail';
import AuthorityMap from '../pages/authority/AuthorityMap';
import AuthoritySOS from '../pages/authority/AuthoritySOS';
import AuthorityAnalytics from '../pages/authority/AuthorityAnalytics';
import AuthorityProfile from '../pages/authority/AuthorityProfile';
import AuthorityCommunities from '../pages/authority/AuthorityCommunities';
import AuthorityCommunityDetail from '../pages/authority/AuthorityCommunityDetail';

import AdminLayout from '../layouts/AdminLayout';
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminAuthorities from '../pages/admin/AdminAuthorities';
import AdminReports from '../pages/admin/AdminReports';
import AdminCategories from '../pages/admin/AdminCategories';
import AdminSpecializations from '../pages/admin/AdminSpecializations';
import AdminSOS from '../pages/admin/AdminSOS';
import AdminAnalytics from '../pages/admin/AdminAnalytics';
import AdminMap from '../pages/admin/AdminMap';
import AdminCommunities from '../pages/admin/AdminCommunities';
import AdminCommunityDetail from '../pages/admin/AdminCommunityDetail';
import AdminEditCommunityPage from '../pages/admin/AdminEditCommunityPage';

import { useAuthStore } from '../store/authStore';

// الصفحة الجديدة للسوبر أدمن
import RoleManagement from '../pages/superadmin/RoleManagement';

function RootRedirect() {
  const { user, isAuthenticated } = useAuthStore();

  // خلينا التوجيه الافتراضي هنا لـ /signup بدل /login
  if (!isAuthenticated || !user) return <Navigate to="/signup" replace />;

  const isSuperAdmin = Array.isArray(user.role) ? user.role.includes('SuperAdmin') : user.role === 'SuperAdmin';
  const isAdmin = Array.isArray(user.role) ? user.role.includes('Admin') : user.role === 'Admin';
  const isAuthority = Array.isArray(user.role) ? user.role.includes('Authority') : user.role === 'Authority';
  const isCitizen = Array.isArray(user.role) ? user.role.includes('Citizen') : user.role === 'Citizen';

  if (isSuperAdmin || isAdmin) return <Navigate to="/admin/dashboard" replace />;
  if (isAuthority) return <Navigate to="/authority/dashboard" replace />;
  if (isCitizen) return <Navigate to="/citizen/feed" replace />;

  return <Navigate to="/unauthorized" replace />;
}


const router = createBrowserRouter([
  // السطر ده اللي كان ناقص عشان الـ Error يختفي
  { path: '/', element: <RootRedirect /> },
  // ── Dev-only token injection (always accessible) ──
  { path: '/dev-login', element: <DevLogin /> },

  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/signup/*', element: <Signup /> }
    ]
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <RoleGuard allowedRoles={['Citizen']} />,
        children: [
          {
            element: <CitizenLayout />,
            children: [
              { path: '/citizen/feed', element: <CitizenFeed /> },
              { path: '/citizen/map', element: <CitizenMap /> },
              { path: '/citizen/my-reports', element: <MyReports /> },
              { path: '/citizen/report/new', element: <NewReport /> },
              { path: '/citizen/report/:id', element: <ReportDetail /> },
              { path: '/citizen/sos', element: <SOS /> },
              { path: '/citizen/communities', element: <Communities /> },
              { path: '/citizen/communities/create', element: <CreateCommunityPage /> },
              { path: '/citizen/communities/discover', element: <DiscoverCommunities /> },
              { path: '/citizen/communities/:id/edit', element: <EditCommunityPage /> },
              { path: '/citizen/communities/:id', element: <CitizenCommunityDetail /> },
              { path: '/citizen/profile', element: <Profile /> },
            ]
          }
        ]
      },
      {
        element: <RoleGuard allowedRoles={['Authority', 'Admin', 'SuperAdmin']} />,
        children: [
          {
            element: <AuthorityLayout />,
            children: [
              { path: '/authority/dashboard', element: <AuthorityDashboard /> },
              { path: '/authority/feed', element: <AuthorityFeed /> },
              { path: '/authority/map', element: <AuthorityMap /> },
              { path: '/authority/report/:id', element: <AuthorityReportDetail /> },
              { path: '/authority/sos', element: <AuthoritySOS /> },
              { path: '/authority/analytics', element: <AuthorityAnalytics /> },
              { path: '/authority/profile',      element: <AuthorityProfile /> },
              { path: '/authority/communities', element: <AuthorityCommunities /> },
              { path: '/authority/communities/:id', element: <AuthorityCommunityDetail /> },
            ]
          }
        ]
      },
      {
        element: <RoleGuard allowedRoles={['Admin', 'SuperAdmin']} />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { path: '/admin/dashboard', element: <AdminDashboard /> },
              { path: '/admin/users', element: <AdminUsers /> },
              { path: '/admin/authorities', element: <AdminAuthorities /> },
              { path: '/admin/reports', element: <AdminReports /> },
              { path: '/admin/reports/:id', element: <AuthorityReportDetail /> },
              { path: '/admin/categories', element: <AdminCategories /> },
              { path: '/admin/specializations', element: <AdminSpecializations /> },
              { path: '/admin/sos', element: <AdminSOS /> },
              { path: '/admin/analytics',        element: <AdminAnalytics /> },
              { path: '/admin/map',               element: <AdminMap /> },
              { path: '/admin/communities',        element: <AdminCommunities /> },
              { path: '/admin/communities/:id/edit', element: <AdminEditCommunityPage /> },
              { path: '/admin/communities/:id',    element: <AdminCommunityDetail /> },
              
              // مسار السوبر أدمن المضاف بداخل نطاق الحماية المشترك
              { path: '/superadmin/roles', element: <RoleManagement /> },
            ]
          }
        ]
      }
    ]
  },
  { path: '/unauthorized', element: <div className="text-white p-8">Unauthorized Access</div> }
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}