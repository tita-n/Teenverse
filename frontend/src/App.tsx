import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { lazy, Suspense } from "react";
import { AuthProvider } from "./hooks/useAuth";

const Register = lazy(() => import("./Register"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const RantZone = lazy(() => import("./pages/RantZone"));
const GameSquad = lazy(() => import("./pages/GameSquad"));
const SquadDetails = lazy(() => import("./pages/SquadDetails"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Profile = lazy(() => import("./pages/Profile"));
const ControlPanel = lazy(() => import("./pages/ControlPanel"));
const NewsFeed = lazy(() => import("./pages/NewsFeed"));
const BuyCoins = lazy(() => import("./pages/BuyCoins"));
const HypeBattles = lazy(() => import("./pages/HypeBattles"));
const CloutMissions = lazy(() => import("./pages/CloutMissions"));
const HallOfFame = lazy(() => import("./pages/HallOfFame"));
const Shop = lazy(() => import("./pages/Shop"));
const Titan = lazy(() => import("./pages/Titan"));
const CreatePost = lazy(() => import("./pages/CreatePost"));
const Analytics = lazy(() => import("./pages/Analytics"));
const UltimateShowdown = lazy(() => import("./pages/UltimateShowdown"));
const ChatList = lazy(() => import("./pages/ChatList"));
const ChatDetail = lazy(() => import("./pages/ChatDetail"));
const Settings = lazy(() => import("./pages/Settings"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
    </div>
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

export default function App() {
  return (
    <AuthProvider>
      <HelmetProvider>
        <Router>
          <Suspense fallback={<PageLoader />}>
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
          </Suspense>
        </Router>
      </HelmetProvider>
    </AuthProvider>
  );
}
