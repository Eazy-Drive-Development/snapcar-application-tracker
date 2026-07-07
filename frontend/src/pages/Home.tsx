import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import DashboardView from '../components/DashboardView';
import PaymentView from '../components/PaymentView';
import SubscriptionsView from '../components/SubscriptionsView';
import VendorListingsView from '../components/VendorListingsView';
import AccountView from '../components/AccountView';

type AppSection = 'home' | 'payment' | 'subscriptions' | 'vendor-listings' | 'account';

function getSectionFromPath(pathname: string): AppSection {
  if (pathname === '/acount' || pathname === '/account') {
    return 'account';
  }

  if (pathname === '/subscriptions') {
    return 'subscriptions';
  }

  if (pathname === '/vendor-listings') {
    return 'vendor-listings';
  }

  if (pathname === '/payment') {
    return 'payment';
  }

  return 'home';
}

function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<AppSection>(() => getSectionFromPath(location.pathname));

  useEffect(() => {
    setActiveSection(getSectionFromPath(location.pathname));
  }, [location.pathname]);

  const handleNavigate = (section: AppSection) => {
    setActiveSection(section);
    navigate(section === 'home' ? '/home' : section === 'account' ? '/acount' : `/${section}`);
  };

  return (
    <div className="app-layout">
      <Sidebar activeSection={activeSection} onNavigate={handleNavigate} />

      <div className="main-content">
        {activeSection === 'home' && <DashboardView />}
        {activeSection === 'payment' && <PaymentView />}
        {activeSection === 'subscriptions' && <SubscriptionsView />}
        {activeSection === 'vendor-listings' && <VendorListingsView />}
        {activeSection === 'account' && <AccountView />}
      </div>
    </div>
  );
}

export default HomePage;
