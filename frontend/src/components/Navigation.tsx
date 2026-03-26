import { useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  Menu, X, LogOut, User, Zap, Trophy, MessageCircle, Coins,
  ShoppingBag, LayoutDashboard, Newspaper, Flame, Users, Settings,
} from "lucide-react";

const navLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/news-feed", label: "News Feed", icon: Newspaper },
  { to: "/rant-zone", label: "Rant Zone", icon: Flame },
  { to: "/game-squad", label: "Game Squad", icon: Users },
  { to: "/hype-battles", label: "HYPE Battles", icon: Zap },
  { to: "/ultimate-showdown", label: "Ultimate Showdown", icon: Trophy },
  { to: "/clout-missions", label: "Clout Missions", icon: Flame },
  { to: "/hall-of-fame", label: "Hall of Fame", icon: Trophy },
  { to: "/buy-coins", label: "Buy Coins", icon: Coins },
  { to: "/shop", label: "Shop", icon: ShoppingBag },
];

const authLinks = [
  { to: "/chats", label: "Chats", icon: MessageCircle, requiresAuth: true },
  { to: "/profile", label: "Profile", icon: User, requiresAuth: true, dynamic: true },
  { to: "/settings", label: "Settings", icon: Settings, requiresAuth: true },
];

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = useCallback(() => {
    logout();
    navigate("/");
    setIsOpen(false);
  }, [logout, navigate]);

  const isActive = useCallback((path: string) => location.pathname === path, [location.pathname]);

  const renderNavLink = useCallback((link: { to: string; label: string; icon: any; dynamic?: boolean }, isMobile = false) => {
    const href = link.dynamic && user?.username ? `${link.to}/${user.username}` : link.to;
    const Icon = link.icon;
    const active = isActive(href) || (link.dynamic && location.pathname.startsWith(link.to));

    return (
      <Link
        key={link.to}
        to={href}
        onClick={() => isMobile && setIsOpen(false)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
          active
            ? "bg-white/20 text-white"
            : "text-white/80 hover:text-white hover:bg-white/10"
        } ${isMobile ? "w-full" : ""}`}
      >
        <Icon className="w-4 h-4" />
        {link.label}
      </Link>
    );
  }, [user, isActive, location.pathname]);

  return (
    <nav className="bg-gradient-to-r from-brand-600 to-brand-700 shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">TeenVerse</span>
          </Link>

          {user && (
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => renderNavLink(link))}
            </div>
          )}

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to={authLinks[1].dynamic ? `${authLinks[1].to}/${user.username}` : authLinks[1].to}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white/90 hover:bg-white/10 transition-colors"
                >
                  <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-xs font-semibold">
                    {(user.username || user.email || "U").charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{user.username || user.email}</span>
                </Link>
                {authLinks.filter((l) => !l.dynamic).map((link) => renderNavLink(link))}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-red-500/20 transition-colors text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Log Out
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/" className="px-3 py-2 rounded-lg text-white/80 hover:bg-white/10 transition-colors text-sm">
                  Log In
                </Link>
                <Link to="/register" className="bg-white text-brand-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/90 transition-colors">
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            aria-label={isOpen ? "Close menu" : "Open menu"}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <div
        className={`lg:hidden overflow-hidden bg-brand-700/50 backdrop-blur-sm transition-all duration-200 ease-in-out ${
          isOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 py-4 space-y-1">
          {user ? (
            <>
              <div className="flex items-center gap-3 px-3 py-2 mb-3 bg-white/10 rounded-lg">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white font-semibold">
                  {(user.username || user.email || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-medium">{user.username || user.email}</p>
                  <p className="text-white/60 text-xs">Welcome back!</p>
                </div>
              </div>
              {navLinks.map((link) => renderNavLink(link, true))}
              <div className="border-t border-white/10 pt-2 mt-2">
                {authLinks.map((link) => renderNavLink(link, true))}
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-300 hover:bg-red-500/20 transition-colors text-sm mt-2"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <Link
                to="/"
                onClick={() => setIsOpen(false)}
                className="block w-full text-center px-4 py-3 rounded-lg text-white hover:bg-white/10 transition-colors"
              >
                Log In
              </Link>
              <Link
                to="/register"
                onClick={() => setIsOpen(false)}
                className="block w-full text-center px-4 py-3 rounded-lg bg-white text-brand-700 font-medium"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
