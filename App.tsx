
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { VoiceInterface } from './components/VoiceInterface';
import { Auth } from './components/Auth';
import { SubscriptionModal } from './components/SubscriptionModal';
import { UserProfile, ChatSession, MessageRole, ChatMessage, VoiceName, Participant } from './types';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('botwave_authenticated') === 'true';
  });
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Initialize user with a stable ID and Pro status from local storage
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('botwave_user_v2');
    if (saved) return JSON.parse(saved);
    return {
      id: crypto.randomUUID(),
      username: 'Explorer_' + Math.floor(Math.random() * 1000),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`,
      preferredVoice: 'Zephyr',
      isPro: false
    };
  });

  // Setup BroadcastChannel for real-time collaboration simulation across tabs
  const channel = useMemo(() => new BroadcastChannel('botwave_sync'), []);

  useEffect(() => {
    if (!isLoggedIn) return;
    
    const savedSessions = localStorage.getItem('botwave_sessions_v2');
    if (savedSessions) {
      const parsed = JSON.parse(savedSessions);
      setSessions(parsed);
      if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
    } else {
      createNewSession();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      localStorage.setItem('botwave_sessions_v2', JSON.stringify(sessions));
    }
  }, [sessions, isLoggedIn]);

  useEffect(() => {
    localStorage.setItem('botwave_user_v2', JSON.stringify(userProfile));
    channel.postMessage({ type: 'USER_UPDATE', user: userProfile });
  }, [userProfile, channel]);

  // Handle incoming messages from other "users" (tabs)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data, sessionId, senderId } = event.data;

      if (type === 'NEW_MESSAGE' && senderId !== userProfile.id) {
        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: [...s.messages, data],
          lastUpdated: Date.now()
        } : s));
      } else if (type === 'SYNC_SESSIONS') {
        setSessions(data);
      }
    };

    channel.onmessage = handleMessage;
    return () => { channel.close(); };
  }, [channel, userProfile.id]);

  const createNewSession = () => {
    const newId = crypto.randomUUID();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Wave',
      messages: [],
      lastUpdated: Date.now(),
      collaborators: [],
      participants: [{ id: userProfile.id, name: userProfile.username, avatar: userProfile.avatar, lastActive: Date.now() }]
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setIsSidebarOpen(false);
    channel.postMessage({ type: 'SYNC_SESSIONS', data: [newSession, ...sessions] });
  };

  const deleteSession = (id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (currentSessionId === id) setCurrentSessionId(filtered[0]?.id || null);
      channel.postMessage({ type: 'SYNC_SESSIONS', data: filtered });
      return filtered;
    });
  };

  const toggleCollaborator = (collabId: string) => {
    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id === currentSessionId) {
          const hasIt = s.collaborators.includes(collabId);
          return {
            ...s,
            collaborators: hasIt 
              ? s.collaborators.filter(id => id !== collabId)
              : [...s.collaborators, collabId]
          };
        }
        return s;
      });
      channel.postMessage({ type: 'SYNC_SESSIONS', data: updated });
      return updated;
    });
  };

  const handleSendMessage = useCallback((text: string, imageData?: string) => {
    if (!currentSessionId) return;
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: MessageRole.USER,
      content: { 
        text, 
        image: imageData,
        senderId: userProfile.id,
        senderName: userProfile.username,
        senderAvatar: userProfile.avatar
      },
      timestamp: Date.now(),
    };

    setSessions(prev => prev.map(s => s.id === currentSessionId ? {
      ...s,
      messages: [...s.messages, newMessage],
      lastUpdated: Date.now(),
      title: s.messages.length === 0 ? (text.slice(0, 30) || 'Creative Task') : s.title
    } : s));

    channel.postMessage({ 
      type: 'NEW_MESSAGE', 
      sessionId: currentSessionId, 
      data: newMessage,
      senderId: userProfile.id 
    });
  }, [currentSessionId, userProfile, channel]);

  const handleLoginSuccess = (email: string) => {
    setIsLoggedIn(true);
    localStorage.setItem('botwave_authenticated', 'true');
    localStorage.setItem('botwave_email', email);
    if (userProfile.username.startsWith('Explorer_')) {
      const prefix = email.split('@')[0];
      setUserProfile(prev => ({ ...prev, username: prefix }));
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('botwave_authenticated');
    localStorage.removeItem('botwave_email');
  };

  const handleSubscribe = (plan: 'monthly' | 'yearly') => {
    setUserProfile(prev => ({ ...prev, isPro: true, subscriptionPlan: plan }));
    setIsSubModalOpen(false);
  };

  const handleUpdateProfile = (updates: Partial<UserProfile>) => {
    setUserProfile(prev => ({ ...prev, ...updates }));
  };

  if (!isLoggedIn) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-black font-sans text-neutral-200 overflow-hidden animate-in fade-in duration-700">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] md:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop relative, Mobile fixed/drawer */}
      <div className={`
        fixed md:relative z-[60] h-full transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar 
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={(id) => {
            // Use setCurrentSessionId to switch sessions
            setCurrentSessionId(id);
            setIsSidebarOpen(false);
          }}
          onNewSession={createNewSession}
          onDeleteSession={deleteSession}
          user={userProfile}
          onUpdateUser={(username) => handleUpdateProfile({ username })}
          onUpdateAvatar={(avatar) => handleUpdateProfile({ avatar })}
          onUpdateVoice={(preferredVoice) => handleUpdateProfile({ preferredVoice })}
          onLogout={handleLogout}
          onOpenUpgrade={() => setIsSubModalOpen(true)}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(circle_at_50%_50%,#111111_0%,#000000_100%)]">
        <ChatWindow 
          session={sessions.find(s => s.id === currentSessionId)}
          onSendMessage={handleSendMessage}
          onToggleVoice={() => setIsVoiceActive(true)}
          user={userProfile}
          onToggleCollab={toggleCollaborator}
          onOpenUpgrade={() => setIsSubModalOpen(true)}
          onOpenMenu={() => setIsSidebarOpen(true)}
          updateSessionMessages={(sessionId, messages) => {
            const updatedSessions = sessions.map(s => s.id === sessionId ? { ...s, messages } : s);
            setSessions(updatedSessions);
            channel.postMessage({ type: 'SYNC_SESSIONS', data: updatedSessions });
          }}
        />
        
        <div className="absolute bottom-1 right-6 text-[8px] md:text-[10px] text-neutral-700 font-mono pointer-events-none tracking-[0.2em]">
          OWNED BY MUHAMMED SABITH KP
        </div>
      </main>

      {isVoiceActive && (
        <VoiceInterface 
          voice={userProfile.preferredVoice}
          onClose={() => setIsVoiceActive(false)}
          onVoiceInput={handleSendMessage}
        />
      )}

      {isSubModalOpen && (
        <SubscriptionModal 
          onClose={() => setIsSubModalOpen(false)} 
          onSubscribe={handleSubscribe} 
        />
      )}
    </div>
  );
};

export default App;
