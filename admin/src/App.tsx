import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { LoginScreen } from './screens/LoginScreen';
import { DriversScreen } from './screens/DriversScreen';
import { TripsScreen } from './screens/TripsScreen';
import { ZonesScreen } from './screens/ZonesScreen';
import { DisputesScreen } from './screens/DisputesScreen';
import { AuditLogScreen } from './screens/AuditLogScreen';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-sm text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Navigate to="/drivers" replace />} />
            <Route path="/drivers" element={<DriversScreen />} />
            <Route path="/trips" element={<TripsScreen />} />
            <Route path="/zones" element={<ZonesScreen />} />
            <Route path="/disputes" element={<DisputesScreen />} />
            <Route path="/audit-log" element={<AuditLogScreen />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
