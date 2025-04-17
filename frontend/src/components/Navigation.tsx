import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Navigation() {
    const [isOpen, setIsOpen] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/");
        setIsOpen(false);
    };

    return (
        <nav className="bg-indigo-600 p-4">
            <div className="max-w-4xl mx-auto flex justify-between items-center">
                {/* Logo */}
                <h1 className="text-white text-2xl font-bold">
                    <Link to="/">TeenVerse</Link>
                </h1>

                {/* Desktop Menu */}
                <div className="hidden md:flex items-center space-x-4">
                    {user ? (
                        <>
                            <span className="text-white">Welcome, {user.username || user.email}!</span>
                            <Link to="/dashboard" className="text-white hover:text-indigo-200">
                                Dashboard
                            </Link>
                            <Link to="/news-feed" className="text-white hover:text-indigo-200">
                                News Feed
                            </Link>
                            <Link to="/rant-zone" className="text-white hover:text-indigo-200">
                                Rant Zone
                            </Link>
                            <Link to="/game-squad" className="text-white hover:text-indigo-200">
                                Game Squad
                            </Link>
                            <Link to="/hype-battles" className="text-white hover:text-indigo-200">
                                HYPE Battles
                            </Link>
                            <Link to="/ultimate-showdown" className="text-white hover:text-indigo-200">
                                Ultimate Showdown
                            </Link>
                            <Link to="/clout-missions" className="text-white hover:text-indigo-200">
                                Clout Missions
                            </Link>
                            <Link to="/hall-of-fame" className="text-white hover:text-indigo-200">
                                Hall of Fame
                            </Link>
                            <Link to="/buy-coins" className="text-white hover:text-indigo-200">
                                Buy Coins
                            </Link>
                            <Link to="/profile" className="text-white hover:text-indigo-200">
                                Profile
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 transition"
                            >
                                Log Out
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/" className="text-white hover:text-indigo-200">
                                Login
                            </Link>
                            <Link to="/register" className="text-white hover:text-indigo-200">
                                Register
                            </Link>
                        </>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <div className="md:hidden flex items-center">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="text-white focus:outline-none"
                    >
                        <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                            />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden mt-2">
                    <div className="flex flex-col space-y-2">
                        {user ? (
                            <>
                                <span className="text-white px-3 py-1">
                                    Welcome, {user.username || user.email}!
                                </span>
                                <Link
                                    to="/dashboard"
                                    className="text-white hover:text-indigo-200 px-3 py-1"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    to="/news-feed"
                                    className="text-white hover:text-indigo-200 px-3 py-1"
                                    onClick={() => setIsOpen(false)}
                                >
                                    News Feed
                                </Link>
                                <Link
                                    to="/rant-zone"
                                    className="text-white hover:text-indigo-200 px-3 py-1"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Rant Zone
                                </Link>
                                <Link
                                    to="/game-squad"
                                    className="text-white hover:text-indigo-200 px-3 py-1"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Game Squad
                                </Link>
                                <Link
                                    to="/hype-battles"
                                    className="text-white hover:text-indigo-200 px-3 py-1"
                                    onClick={() => setIsOpen(false)}
                                >
                                    HYPE Battles
                                </Link>
                                <Link
                                    to="/ultimate-showdown"
                                    className="text-white hover:text-indigo-200 px-3 py-1"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Ultimate Showdown
                                </Link>
                                <Link
                                    to="/clout-missions"
                                    className="text-white hover:text-indigo-200 px-3 py-1"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Clout Missions
                                </Link>
                                <Link
                                    to="/hall-of-fame"
                                    className="text-white hover:text-indigo-200 px-3 py-1"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Hall of Fame
                                </Link>
                                <Link
                                    to="/buy-coins"
                                    className="text-white hover:text-indigo-200 px-3 py-1"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Buy Coins
                                </Link>
                                <Link
                                    to="/profile"
                                    className="text-white hover:text-indigo-200 px-3 py-1"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Profile
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 transition text-left"
                                >
                                    Log Out
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/"
                                    className="text-white hover:text-indigo-200 px-3 py-1"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Login
                                </Link>
                                <Link
                                    to="/register"
                                    className="text-white hover:text-indigo-200 px-3 py-1"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Register
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
                                }
