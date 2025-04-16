import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SocketProvider } from "./context/SocketContext.tsx";
import './index.css' // Add this line

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <SocketProvider>
    <App />
      <SocketProvider>
  </React.StrictMode>
);
