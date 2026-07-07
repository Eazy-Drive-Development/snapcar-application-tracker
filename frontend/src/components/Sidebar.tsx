import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface SidebarProps {
  activeSection: 'home' | 'payment' | 'subscriptions' | 'vendor-listings' | 'account';
  onNavigate: (section: 'home' | 'payment' | 'subscriptions' | 'vendor-listings' | 'account') => void;
}

function Sidebar({ activeSection, onNavigate }: SidebarProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('snapcar-tracker-auth');
    navigate('/login');
  };

  const handleNavigation = (section: 'home' | 'payment' | 'subscriptions' | 'vendor-listings' | 'account') => {
    onNavigate(section);
    setIsOpen(false);
  };

  return (
    <>
      <button className={`hamburger ${isOpen ? 'active' : ''}`} type="button" onClick={() => setIsOpen(!isOpen)}>
        <span />
        <span />
        <span />
      </button>

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-content">
          <div className="sidebar-header">
            <h2>Menu</h2>
            <button className="close-btn" type="button" onClick={() => setIsOpen(false)}>
              ✕
            </button>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeSection === 'home' ? 'active' : ''}`}
              type="button"
              onClick={() => handleNavigation('home')}
            >
              <span className="icon">🏠</span>
              <span>Home</span>
            </button>

            <button
              className={`nav-item ${activeSection === 'payment' ? 'active' : ''}`}
              type="button"
              onClick={() => handleNavigation('payment')}
            >
              <span className="icon">💳</span>
              <span>Payment</span>
            </button>

            <button
              className={`nav-item ${activeSection === 'subscriptions' ? 'active' : ''}`}
              type="button"
              onClick={() => handleNavigation('subscriptions')}
            >
              <span className="icon">S</span>
              <span>Subscriptions</span>
            </button>

            <button
              className={`nav-item ${activeSection === 'vendor-listings' ? 'active' : ''}`}
              type="button"
              onClick={() => handleNavigation('vendor-listings')}
            >
              <span className="icon">V</span>
              <span>Vendor Listings</span>
            </button>

            <button
              className={`nav-item ${activeSection === 'account' ? 'active' : ''}`}
              type="button"
              onClick={() => handleNavigation('account')}
            >
              <span className="icon">A</span>
              <span>Account</span>
            </button>

            <button className="nav-item logout" type="button" onClick={handleLogout}>
              <span className="icon">🚪</span>
              <span>Logout</span>
            </button>
          </nav>
        </div>
      </aside>

      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}
    </>
  );
}

export default Sidebar;
