import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { ChatArea } from './ChatArea';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface ChatUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  username?: string;
  bio?: string;
  status?: 'online' | 'offline';
  lastSeen?: any;
  lastMessage?: {
    text: string;
    timestamp: any;
    senderId: string;
    read?: boolean;
  };
  unreadCount?: number;
}

export const ChatLayout: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [theme, setTheme] = useState('light');
  const { user, logout } = useAuth();

  useEffect(() => {
    if (user) {
      const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
        if (doc.exists()) {
          setTheme(doc.data().settings?.theme || 'light');
        }
      });
      return () => unsub();
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className={`flex h-[100dvh] bg-[#f5f5f7] font-sans overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Sidebar */}
      <div className={`w-full md:w-[380px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
        <Sidebar selectedUser={selectedUser} onSelectUser={setSelectedUser} currentUser={user} onLogout={logout} />
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 bg-[#f5f5f7] flex flex-col ${!selectedUser ? 'hidden md:flex' : 'flex'}`}>
        {selectedUser ? (
          <ChatArea selectedUser={selectedUser} currentUser={user} onBack={() => setSelectedUser(null)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <MessageSquare className="w-10 h-10 text-gray-300" />
            </div>
            <h2 className="text-2xl font-medium text-gray-800 mb-2">Your Messages</h2>
            <p className="text-gray-500">Select a conversation to start chatting.</p>
          </div>
        )}
      </div>
    </div>
  );
};
