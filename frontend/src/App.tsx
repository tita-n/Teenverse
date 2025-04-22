import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Register from "./Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RantZone from "./pages/RantZone";
import GameSquad from "./pages/GameSquad";
import SquadDetails from "./pages/SquadDetails";
import Profile from "./pages/Profile";
import ControlPanel from "./pages/ControlPanel";
import NewsFeed from "./pages/NewsFeed";
import BuyCoins from "./pages/BuyCoins";
import HypeBattles from "./pages/HypeBattles";
import CloutMissions from "./pages/CloutMissions";
import HallOfFame from "./pages/HallOfFame";
import Shop from './pages/Shop';
import CreatePost from "./pages/CreatePost";
import Analytics from "./pages/Analytics";
import UltimateShowdown from "./pages/UltimateShowdown";
import ChatList from "./pages/ChatList";
import ChatDetail from "./pages/ChatDetail";
import Settings from "./pages/Settings"; // Add this
import { AuthProvider } from "./hooks/useAuth";

export default function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/rant-zone" element={<RantZone />} />
                    <Route path="/game-squad" element={<GameSquad />} />
                    <Route path="/squad-details/:squadId" element={<SquadDetails />} />
                    <Route path="/profile/:username" element={<Profile />} />
                    <Route path="/control-panel" element={<ControlPanel />} />
                    <Route path="/news-feed" element={<NewsFeed />} />
                    <Route path="/buy-coins" element={<BuyCoins />} />
                    <Route path="/hype-battles" element={<HypeBattles />} />
                    <Route path="/shop" element={<Shop />} />
                    <Route path="/clout-missions" element={<CloutMissions />} />
                    <Route path="/hall-of-fame" element={<HallOfFame />} />
                    <Route path="/create-post" element={<CreatePost />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/ultimate-showdown" element={<UltimateShowdown />} />
                    <Route path="/chats" element={<ChatList />} />
                    <Route path="/chat/:conversationId" element={<ChatDetail />} />
                    <Route path="/settings" element={<Settings />} /> {/* Add this */}
                    <Route path="*" element={<div>404 - Page Not Found</div>} />
                </Routes>
            </Router>
        </AuthProvider>
    );
}