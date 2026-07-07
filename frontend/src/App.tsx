import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/Login';
import HomePage from './pages/Home';

const isAuthenticated = () => localStorage.getItem('snapcar-tracker-auth') === 'true';

function RequireAuth({ children }: { children: JSX.Element }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/payment" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/subscriptions" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/vendor-listings" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/acount" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
