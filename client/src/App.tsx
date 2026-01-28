import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Toaster } from "sonner";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import AppLayout from "./layout/AppLayout";
import Chat from "./pages/Chat";
import DMChat from "./pages/DMChat";
import { DefaultChannelRedirect } from "./components/DefaultChannelRedirect";
import { API_URL } from "@/lib/api-client";

import Threads from "./pages/Threads";
import Bookmarks from "./pages/Bookmarks";

const queryClient = new QueryClient();

// Component to check workspace status and redirect to onboarding if needed
function StatusCheck() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/status`, {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          if (!data.hasUsers) {
            navigate('/onboarding', { replace: true });
          }
        }
      } catch (error) {
        console.error('Failed to check workspace status', error);
      }
    };

    checkStatus();
  }, [navigate]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <StatusCheck />
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/create-organization" element={<Navigate to="/" replace />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<DefaultChannelRedirect />} />
            <Route path="/channels/:channelId" element={<Chat />} />
            <Route path="/dms/:sessionId" element={<DMChat />} />
            <Route path="/threads" element={<Threads />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
