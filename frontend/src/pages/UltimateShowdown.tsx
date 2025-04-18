// src/pages/WelcomePage.tsx
import React from 'react';
import { useAuth } from '../hooks/useAuth'; // Custom hook for user info

const WelcomePage = () => {
  const { user } = useAuth();

  return (
    <div>
      <h1>Welcome to TeenVerse, {user?.username}!</h1>
      <button onClick={() => window.location.href = '/home'}>Go to News Feed</button>
    </div>
  );
};

export default WelcomePage;
