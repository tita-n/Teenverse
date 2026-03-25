import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Register from "./Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RantZone from "./pages/RantZone";
import GameSquad from "./pages/GameSquad";
import SquadDetails from "./pages/SquadDetails";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Profile from "./pages/Profile";
import ControlPanel from "./pages/ControlPanel";
import NewsFeed from "./pages/NewsFeed";
import BuyCoins from "./pages/BuyCoins";
import HypeBattles from "./pages/HypeBattles";
import CloutMissions from "./pages/CloutMissions";
import HallOfFame from "./pages/HallOfFame";
import Shop from "./pages/Shop";
import Titan from "./pages/Titan";
import CreatePost from "./pages/CreatePost";
import Analytics from "./pages/Analytics";
import UltimateShowdown from "./pages/UltimateShowdown";
import ChatList from "./pages/ChatList";
import ChatDetail from "./pages/ChatDetail";
import Settings from "./pages/Settings";
import { AuthProvider } from "./hooks/useAuth";
import { SocketProvider } from "./context/SocketContext";

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <HelmetProvider>
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
              <Route path="/titan" element={<Titan />} />
              <Route path="/chat/:conversationId" element={<ChatDetail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </HelmetProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-brand-600 mb-4">404</h1>
        <p className="text-xl text-tx-secondary mb-6">Page not found</p>
        <a href="/" className="btn-primary">Go Home</a>
      </div>
    </div>
  );
}
