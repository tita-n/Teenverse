import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion"; // For animations
import { MenuIcon, XIcon, LogOutIcon, UserIcon, ZapIcon, TrophyIcon, MessageCircleIcon, CoinsIcon, ShoppingBagIcon, LayoutDashboardIcon, NewspaperIcon, FlameIcon, UsersIcon } from "lucide-react"; // For icons
import Confetti from "react-confetti"; // For celebratory logout effect

export default function Navigation() {
    const [isOpen, setIsOpen] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation(); // To highlight active route

    const handleLogout = () => {
        logout();
        setShowConfetti(true);
        setTimeout(() => {
            setShowConfetti(false);
            navigate("/");
            setIsOpen(false);
        }, 2000); // Confetti for 2 seconds before redirect
    };

    // Navigation links with icons
    const navLinks = [
        { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboardIcon className="w-5 h-5 mr-1" /> },
        { to: "/news-feed", label: "News Feed", icon: <NewspaperIcon className="w-5 h-5 mr-1" /> },
        { to: "/rant-zone", label: "Rant Zone", icon: <FlameIcon className="w-5 h-5 mr-1" /> },
        { to: "/game-squad", label: "Game Squad", icon: <UsersIcon className="w-5 h-5 mr-1" /> },
        { to: "/hype-battles", label: "HYPE Battles", icon: <ZapIcon className="w-5 h-5 mr-1" /> },
        { to: "/ultimate-showdown", label: "Ultimate Showdown", icon: <TrophyIcon className="w-5 h-5 mr-1" /> },
        { to: "/clout-missions", label: "Clout Missions", icon: <FlameIcon className="w-5 h-5 mr-1" /> },
        { to: "/hall-of-fame", label: "Hall of Fame", icon: <TrophyIcon className="w-5 h-5 mr-1" /> },
        { to: "/buy-coins", label: "Buy Coins", icon: <CoinsIcon className="w-5 h-5 mr-1" /> },
        { to: "/shop", label: "Shop", icon: <ShoppingBagIcon className="w-5 h-5 mr-1" /> },
        { to: `/profile/${user?.username || ''}`, label: "Profile", icon: <UserIcon className="w-5 h-5 mr-1" />, hide: !user },
        { to: "/control-panel", label: "Control Panel", icon: <LayoutDashboardIcon className="w-5 h-5 mr-1" />, hide: user?.email !== "restorationmichael3@gmail.com" },
        { to: "/chats", label: "Chats", icon: <MessageCircleIcon className="w-5 h-5 mr-1" />, hide: !user },
    ];

    return (
        <>
            {showConfetti && <Confetti recycle={false} numberOfPieces={200} />}
            <motion.nav
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ type: "spring", stiffness: 120 }}
                className="bg-gradient-to-r from-purple-600 to-blue-500 p-4 shadow-lg sticky top-0 z-50"
            >
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    {/* Logo */}
                    <motion.h1
                        whileHover={{ scale: 1.05 }}
                        className="text-white text-3xl font-extrabold tracking-tight"
                    >
                        <Link to="/" className="flex items-center">
                            <ZapIcon className="w-8 h-8 mr-2" />
                            TeenVerse
                        </Link>
                    </motion.h1>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-4">
                        {user ? (
                            <>
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-white font-semibold flex items-center"
                                >
                                    <UserIcon className="w-5 h-5 mr-1" />
                                    {user.username || user.email}
                                </motion.span>
                                {navLinks.map((link) => (
                                    !link.hide && (
                                        <motion.div
                                            key={link.to}
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            <Link
                                                to={link.to}
                                                className={`text-white hover:text-indigo-200 flex items-center px-3 py-1 rounded-lg transition ${
                                                    location.pathname === link.to ? "bg-indigo-700 font-bold" : ""
                                                }`}
                                            >
                                                {link.icon}
                                                {link.label}
                                                {link.label === "Chats" && (
                                                    <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">3</span>
                                                )}
                                            </Link>
                                        </motion.div>
                                    )
                                ))}
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleLogout}
                                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition flex items-center"
                                >
                                    <LogOutIcon className="w-5 h-5 mr-1" />
                                    Log Out
                                </motion.button>
                            </>
                        ) : (
                            <>
                                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                                    <Link to="/" className="text-white hover:text-indigo-200 px-3 py-1 rounded-lg transition">
                                        Login
                                    </Link>
                                </motion.div>
                                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                                    <Link to="/register" className="text-white hover:text-indigo-200 px-3 py-1 rounded-lg transition">
                                        Register
                                    </Link>
                                </motion.div>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden flex items-center">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setIsOpen(!isOpen)}
                            className="text-white focus:outline-none"
                            aria-label={isOpen ? "Close menu" : "Open menu"}
                        >
                            {isOpen ? (
                                <XIcon className="w-6 h-6" />
                            ) : (
                                <MenuIcon className="w-6 h-6" />
                            )}
                        </motion.button>
                    </div>
                </div>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="md:hidden mt-2 bg-indigo-700 rounded-lg p-4"
                        >
                            <div className="flex flex-col space-y-2">
                                {user ? (
                                    <>
                                        <span className="text-white px-3 py-1 font-semibold flex items-center">
                                            <UserIcon className="w-5 h-5 mr-1" />
                                            Welcome, {user.username || user.email}!
                                        </span>
                                        {navLinks.map((link) => (
                                            !link.hide && (
                                                <motion.div
                                                    key={link.to}
                                                    whileHover={{ x: 5 }}
                                                    whileTap={{ scale: 0.95 }}
                                                >
                                                    <Link
                                                        to={link.to}
                                                        className={`text-white hover:text-indigo-200 px-3 py-1 flex items-center rounded-lg transition ${
                                                            location.pathname === link.to ? "bg-indigo-600 font-bold" : ""
                                                        }`}
                                                        onClick={() => setIsOpen(false)}
                                                    >
                                                        {link.icon}
                                                        {link.label}
                                                        {link.label === "Chats" && (
                                                            <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">3</span>
                                                        )}
                                                    </Link>
                                                </motion.div>
                                            )
                                        ))}
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={handleLogout}
                                            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition flex items-center"
                                        >
                                            <LogOutIcon className="w-5 h-5 mr-1" />
                                            Log Out
                                        </motion.button>
                                    </>
                                ) : (
                                    <>
                                        <motion.div whileHover={{ x: 5 }} whileTap={{ scale: 0.95 }}>
                                            <Link
                                                to="/"
                                                className="text-white hover:text-indigo-200 px-3 py-1 rounded-lg transition"
                                                onClick={() => setIsOpen(false)}
                                            >
                                                Login
                                            </Link>
                                        </motion.div>
                                        <motion.div whileHover={{ x: 5 }} whileTap={{ scale: 0.95 }}>
                                            <Link
                                                to="/register"
                                                className="text-white hover:text-indigo-200 px-3 py-1 rounded-lg transition"
                                                onClick={() => setIsOpen(false)}
                                            >
                                                Register
                                            </Link>
                                        </motion.div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.nav>
        </>
    );
         }
