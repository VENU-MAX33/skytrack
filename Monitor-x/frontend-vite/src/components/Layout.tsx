import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Header menuOpen={mobileMenuOpen} onMenuToggle={() => setMobileMenuOpen((open) => !open)} />
      <div className="wrapper relative">
        <Sidebar open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        {mobileMenuOpen && (
          <button
            type="button"
            aria-label="Close navigation menu"
            className="sidebar-backdrop"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        <main id="main-content" tabIndex={-1} className="content-wrapper p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
