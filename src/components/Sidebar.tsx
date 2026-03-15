import React, { useEffect, useState, useRef } from 'react';
import { collection, query, onSnapshot, orderBy, getDocs, where, setDoc, doc, serverTimestamp, writeBatch, deleteDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { ChatUser } from './ChatLayout';
import { User } from 'firebase/auth';
import { LogOut, Search, Users, UserPlus, X, Trash2, AlertCircle, Settings, Camera, Check, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { Modal } from './Modal';
import { ContactItem } from './ContactItem';

interface SidebarProps {
  selectedUser: ChatUser | null;
  onSelectUser: (user: ChatUser) => void;
  currentUser: User;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ selectedUser, onSelectUser, currentUser, onLogout }) => {
  const [contacts, setContacts] = useState<ChatUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);
  const [globalResults, setGlobalResults] = useState<ChatUser[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [contactToRemove, setContactToRemove] = useState<ChatUser | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(currentUser.displayName || '');
  const [newUsername, setNewUsername] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [bio, setBio] = useState('');
  const [theme, setTheme] = useState('light');
  const [wallpaper, setWallpaper] = useState('default');
  const [readReceipts, setReadReceipts] = useState(true);
  const [accentColor, setAccentColor] = useState('#3b82f6');
  const [fontSize, setFontSize] = useState('medium');
  const [bubbleStyle, setBubbleStyle] = useState('rounded');
  const [compactView, setCompactView] = useState(false);
  const [hideLastSeen, setHideLastSeen] = useState(false);
  const [hideProfilePic, setHideProfilePic] = useState(false);
  const [language, setLanguage] = useState('en');
  const [timeFormat, setTimeFormat] = useState('12h');
  const [customStatus, setCustomStatus] = useState('');
  const [notificationSound, setNotificationSound] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [enterIsSend, setEnterIsSend] = useState(true);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const unsubsRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (showSettingsModal) {
      const fetchUserData = async () => {
        const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
        if (!userDoc.empty) {
          const data = userDoc.docs[0].data();
          setNewDisplayName(data.displayName || currentUser.displayName || '');
          setNewUsername(data.username || '');
          setBio(data.bio || '');
          setTheme(data.settings?.theme || 'light');
          setWallpaper(data.settings?.wallpaper || 'default');
          setReadReceipts(data.settings?.readReceipts !== false);
          setAccentColor(data.settings?.accentColor || '#3b82f6');
          setFontSize(data.settings?.fontSize || 'medium');
          setBubbleStyle(data.settings?.bubbleStyle || 'rounded');
          setCompactView(!!data.settings?.compactView);
          setHideLastSeen(!!data.settings?.hideLastSeen);
          setHideProfilePic(!!data.settings?.hideProfilePic);
          setLanguage(data.settings?.language || 'en');
          setTimeFormat(data.settings?.timeFormat || '12h');
          setCustomStatus(data.settings?.customStatus || '');
          setNotificationSound(data.settings?.notificationSound !== false);
          setVibration(data.settings?.vibration !== false);
          setEnterIsSend(data.settings?.enterIsSend !== false);
        }
      };
      fetchUserData();
      setProfileError('');
      setProfileSuccess(false);
    }
  }, [showSettingsModal, currentUser]);

  useEffect(() => {
    const q = query(collection(db, 'users', currentUser.uid, 'contacts'), orderBy('addedAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contactIds = snapshot.docs.map(doc => doc.id);
      
      // Clear previous unsubs
      unsubsRef.current.forEach(unsub => unsub());
      unsubsRef.current = [];

      if (contactIds.length === 0) {
        setContacts([]);
        return;
      }

      const chunks = [];
      for (let i = 0; i < contactIds.length; i += 30) {
        chunks.push(contactIds.slice(i, i + 30));
      }

      chunks.forEach(chunk => {
        const usersQuery = query(collection(db, 'users'), where('uid', 'in', chunk));
        const unsubUsers = onSnapshot(usersQuery, (userSnapshot) => {
          userSnapshot.forEach(userDoc => {
            const userData = userDoc.data() as ChatUser;
            const chatId = [currentUser.uid, userData.uid].sort().join('_');
            
            const lastMsgQuery = query(
              collection(db, 'chats', chatId, 'messages'),
              orderBy('timestamp', 'desc'),
              limit(1)
            );

            const unsubLastMsg = onSnapshot(lastMsgQuery, (msgSnapshot) => {
              const lastMsg = msgSnapshot.docs[0]?.data();
              
              const unreadQuery = query(
                collection(db, 'chats', chatId, 'messages'),
                where('receiverId', '==', currentUser.uid),
                where('read', '==', false)
              );

              const unsubUnread = onSnapshot(unreadQuery, (unreadSnapshot) => {
                setContacts(prev => {
                  const updatedContacts = [...prev];
                  const index = updatedContacts.findIndex(c => c.uid === userData.uid);
                  const contactData = {
                    ...userData,
                    lastMessage: lastMsg ? {
                      text: lastMsg.text || (lastMsg.imageUrl ? '📷 Image' : ''),
                      timestamp: lastMsg.timestamp,
                      senderId: lastMsg.senderId,
                      read: lastMsg.read
                    } : undefined,
                    unreadCount: unreadSnapshot.size
                  };

                  if (index > -1) {
                    updatedContacts[index] = { ...updatedContacts[index], ...contactData };
                  } else {
                    updatedContacts.push(contactData);
                  }
                  
                  // Sort by last message timestamp or addedAt
                  return updatedContacts
                    .filter(c => contactIds.includes(c.uid))
                    .sort((a, b) => {
                      const timeA = a.lastMessage?.timestamp?.toMillis() || 0;
                      const timeB = b.lastMessage?.timestamp?.toMillis() || 0;
                      return timeB - timeA;
                    });
                });
              }, (error) => {
                console.error("Error fetching unread count:", error);
              });
              unsubsRef.current.push(unsubUnread);
            }, (error) => {
              console.error("Error fetching last message:", error);
            });
            unsubsRef.current.push(unsubLastMsg);
          });
        });
        unsubsRef.current.push(unsubUsers);
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${currentUser.uid}/contacts`);
    });

    return () => {
      unsubscribe();
      unsubsRef.current.forEach(unsub => unsub());
    };
  }, [currentUser.uid]);

  const handleAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const maxDim = 200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          await setDoc(doc(db, 'users', currentUser.uid), {
            photoURL: dataUrl
          }, { merge: true });
          
          setIsUploadingAvatar(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      setIsUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileError('');
    setProfileSuccess(false);

    try {
      const username = newUsername.trim().toLowerCase();
      if (!username) throw new Error("Username is required");

      // Check if username is taken by someone else
      const q = query(collection(db, 'users'), where('username', '==', username));
      const snap = await getDocs(q);
      if (!snap.empty && snap.docs[0].id !== currentUser.uid) {
        throw new Error("Username is already taken");
      }

      await setDoc(doc(db, 'users', currentUser.uid), {
        displayName: newDisplayName.trim(),
        username: username,
        bio: bio.trim(),
        settings: {
          theme,
          wallpaper,
          readReceipts,
          accentColor,
          fontSize,
          bubbleStyle,
          compactView,
          hideLastSeen,
          hideProfilePic,
          language,
          timeFormat,
          customStatus,
          notificationSound,
          vibration,
          enterIsSend
        }
      }, { merge: true });

      setProfileSuccess(true);
      setTimeout(() => setShowSettingsModal(false), 1500);
    } catch (error: any) {
      setProfileError(error.message || "Failed to update profile");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUsername.trim()) return;
    
    setIsAdding(true);
    setAddError('');
    
    try {
      const searchTerm = addUsername.trim().toLowerCase();
      
      // Don't allow adding yourself
      if (searchTerm === currentUser.email?.toLowerCase() || 
          searchTerm === currentUser.email?.split('@')[0].toLowerCase()) {
        setAddError("You can't add yourself as a contact.");
        setIsAdding(false);
        return;
      }
      
      // Search by username or email
      const q1 = query(collection(db, 'users'), where('username', '==', searchTerm));
      const q2 = query(collection(db, 'users'), where('email', '==', searchTerm));
      
      const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      let foundUser: any = null;
      if (!snapshot1.empty) {
        foundUser = snapshot1.docs[0].data();
      } else if (!snapshot2.empty) {
        foundUser = snapshot2.docs[0].data();
      }
      
      if (!foundUser) {
        setAddError("User not found. Please check the username or email.");
        setIsAdding(false);
        return;
      }
      
      // Check if already a contact
      if (contacts.some(c => c.uid === foundUser.uid)) {
        setAddError("This user is already in your contacts.");
        setIsAdding(false);
        return;
      }
      
      // Add to contacts (Mutual)
      const batch = writeBatch(db);
      
      // Add found user to current user's contacts
      const currentUserContactRef = doc(db, 'users', currentUser.uid, 'contacts', foundUser.uid);
      batch.set(currentUserContactRef, {
        uid: foundUser.uid,
        displayName: foundUser.displayName,
        email: foundUser.email,
        username: foundUser.username || '',
        photoURL: foundUser.photoURL || '',
        addedAt: serverTimestamp()
      }, { merge: true });

      // Add current user to found user's contacts
      const otherUserContactRef = doc(db, 'users', foundUser.uid, 'contacts', currentUser.uid);
      batch.set(otherUserContactRef, {
        uid: currentUser.uid,
        displayName: currentUser.displayName || 'Anonymous',
        email: currentUser.email || '',
        username: currentUser.email?.split('@')[0].toLowerCase() || '',
        photoURL: currentUser.photoURL || '',
        addedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      
      toast.success(`${foundUser.displayName} added to contacts!`);
      setShowAddModal(false);
      setAddUsername('');
      
      // Optionally auto-select the new contact
      onSelectUser(foundUser as ChatUser);
      
    } catch (error) {
      console.error("Error adding contact:", error);
      setAddError("An error occurred while adding the contact.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveContact = async () => {
    if (!contactToRemove) return;
    
    setIsRemoving(true);
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'contacts', contactToRemove.uid));
      toast.success('Contact removed');
      setContactToRemove(null);
    } catch (error) {
      console.error("Error removing contact:", error);
      toast.error('Failed to remove contact');
    } finally {
      setIsRemoving(false);
    }
  };

  const filteredContacts = contacts.filter(c => 
    (c.displayName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
    (c.username?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (c.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const handleGlobalSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingGlobal(true);
    try {
      const q1 = query(
        collection(db, 'users'), 
        where('username', '>=', searchQuery.toLowerCase()),
        where('username', '<=', searchQuery.toLowerCase() + '\uf8ff'),
        limit(10)
      );
      const q2 = query(
        collection(db, 'users'), 
        where('email', '==', searchQuery.toLowerCase()),
        limit(1)
      );
      
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const results: ChatUser[] = [];
      const seenUids = new Set();

      [...snap1.docs, ...snap2.docs].forEach(doc => {
        const data = doc.data() as ChatUser;
        if (data.uid !== currentUser.uid && !seenUids.has(data.uid)) {
          results.push(data);
          seenUids.add(data.uid);
        }
      });
      
      setGlobalResults(results);
    } catch (error) {
      console.error("Global search error:", error);
    } finally {
      setIsSearchingGlobal(false);
    }
  };

  useEffect(() => {
    if (isGlobalSearch && searchQuery.trim()) {
      const timeout = setTimeout(handleGlobalSearch, 500);
      return () => clearTimeout(timeout);
    } else {
      setGlobalResults([]);
    }
  }, [searchQuery, isGlobalSearch]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img 
              src={currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName}&background=random`} 
              alt="Profile" 
              className="w-10 h-10 rounded-full object-cover shadow-sm"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Chats</h2>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setShowAddModal(true)}
            className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
            title="Add contact"
          >
            <UserPlus className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={onLogout}
            className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3 bg-white space-y-2">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder={isGlobalSearch ? "Search globally by username/email" : "Search contacts"} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#f5f5f7] text-gray-900 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsGlobalSearch(false)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${!isGlobalSearch ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Contacts
          </button>
          <button 
            onClick={() => setIsGlobalSearch(true)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${isGlobalSearch ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Global Search
          </button>
        </div>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto bg-white">
        {isGlobalSearch ? (
          <div className="divide-y divide-gray-50">
            {isSearchingGlobal ? (
              <div className="p-8 text-center">
                <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-xs text-gray-500">Searching globally...</p>
              </div>
            ) : globalResults.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-sm">No users found</p>
                <p className="text-xs mt-1">Try searching by exact username or email</p>
              </div>
            ) : (
              globalResults.map((user) => (
                <div 
                  key={user.uid}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                  onClick={() => {
                    setAddUsername(user.username || user.email);
                    setShowAddModal(true);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random`} 
                      alt="" 
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{user.displayName}</p>
                      <p className="text-xs text-gray-500">@{user.username || user.email.split('@')[0]}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      addContactByUsername(user.username || user.email);
                    }}
                    className="p-2 bg-blue-50 text-blue-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts yet</h3>
            <p className="text-sm text-gray-500 max-w-[220px] mb-6">
              Add people by their username or email to start chatting.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Add Contact
            </button>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No contacts match your search</div>
        ) : (
          filteredContacts.map((contact) => (
            <ContactItem
              key={contact.uid}
              contact={contact}
              currentUser={currentUser}
              selectedUser={selectedUser}
              onSelect={onSelectUser}
              onRemove={setContactToRemove}
            />
          ))
        )}
      </div>

      {/* Add Contact Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setAddUsername('');
          setAddError('');
        }}
        title="Add Contact"
        footer={
          <>
            <button
              onClick={() => {
                setShowAddModal(false);
                setAddUsername('');
                setAddError('');
              }}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddContact}
              disabled={isAdding || !addUsername.trim()}
              className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isAdding ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Contact'
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Enter the username or email address of the person you want to chat with.
          </p>
          <div className="relative">
            <input
              type="text"
              placeholder="Username or email"
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddContact(e as any)}
              className="w-full bg-[#f5f5f7] border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              autoFocus
            />
          </div>
          {addError && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4" />
              <p>{addError}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Remove Contact Modal */}
      <Modal
        isOpen={!!contactToRemove}
        onClose={() => setContactToRemove(null)}
        title="Remove Contact"
        footer={
          <>
            <button
              onClick={() => setContactToRemove(null)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRemoveContact}
              disabled={isRemoving}
              className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isRemoving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </button>
          </>
        }
      >
        <p className="text-gray-600">
          Are you sure you want to remove <span className="font-semibold text-gray-900">{contactToRemove?.displayName}</span> from your contacts?
        </p>
      </Modal>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="Profile Settings"
        footer={
          <>
            <button
              onClick={() => setShowSettingsModal(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateProfile}
              disabled={isUpdatingProfile}
              className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isUpdatingProfile ? 'Updating...' : profileSuccess ? 'Updated!' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="flex flex-col items-center mb-6">
            <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
              <img 
                src={currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName}&background=random`} 
                alt="Profile" 
                className={`w-24 h-24 rounded-full object-cover border-4 border-white shadow-md transition-opacity ${isUploadingAvatar ? 'opacity-50' : ''}`}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-8 h-8 text-white" />
              </div>
              {isUploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <input 
              type="file" 
              ref={avatarInputRef} 
              onChange={handleAvatarChange} 
              accept="image/*" 
              className="hidden" 
            />
            <p className="text-xs text-gray-400 mt-2">Click to change profile picture</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">Display Name</label>
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">@</span>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="username"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1 ml-1">Only lowercase letters, numbers, and underscores.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              placeholder="Tell us about yourself..."
              rows={2}
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">Custom Status</label>
              <input
                type="text"
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">Theme</label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                  <option value="oled">OLED Dark</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">Accent Color</label>
                <div className="flex gap-2 mt-1">
                  {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAccentColor(color)}
                      className={`w-6 h-6 rounded-full border-2 ${accentColor === color ? 'border-gray-900' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">Font Size</label>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="xlarge">Extra Large</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">Bubble Style</label>
                <select
                  value={bubbleStyle}
                  onChange={(e) => setBubbleStyle(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="rounded">Rounded</option>
                  <option value="sharp">Sharp</option>
                  <option value="minimal">Minimal</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">Time Format</label>
                <select
                  value={timeFormat}
                  onChange={(e) => setTimeFormat(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  <option value="12h">12-hour</option>
                  <option value="24h">24-hour</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Settings className="w-4 h-4 text-gray-500" />
                  <div>
                    <span className="block text-sm font-medium text-gray-900">Notification Sounds</span>
                    <span className="block text-[10px] text-gray-500">Play sound for new messages</span>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={notificationSound}
                  onChange={(e) => setNotificationSound(e.target.checked)}
                  className="w-5 h-5 rounded-md border-gray-300 text-blue-500 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-gray-500" />
                  <div>
                    <span className="block text-sm font-medium text-gray-900">Vibration</span>
                    <span className="block text-[10px] text-gray-500">Vibrate on new messages</span>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={vibration}
                  onChange={(e) => setVibration(e.target.checked)}
                  className="w-5 h-5 rounded-md border-gray-300 text-blue-500 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-gray-500" />
                  <div>
                    <span className="block text-sm font-medium text-gray-900">Enter is Send</span>
                    <span className="block text-[10px] text-gray-500">Press Enter to send message</span>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={enterIsSend}
                  onChange={(e) => setEnterIsSend(e.target.checked)}
                  className="w-5 h-5 rounded-md border-gray-300 text-blue-500 focus:ring-blue-500"
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-900">Read Receipts</p>
                  <p className="text-xs text-gray-500">Let others know when you've read their messages</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={readReceipts}
                    onChange={(e) => setReadReceipts(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-900">Compact View</p>
                  <p className="text-xs text-gray-500">Show more messages on the screen</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={compactView}
                    onChange={(e) => setCompactView(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-900">Privacy: Last Seen</p>
                  <p className="text-xs text-gray-500">Hide your online status from others</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={hideLastSeen}
                    onChange={(e) => setHideLastSeen(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>
            </div>
          </div>

          {profileError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p>{profileError}</p>
            </div>
          )}

          {profileSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-600 rounded-xl text-sm animate-in fade-in slide-in-from-top-1">
              <Check className="w-4 h-4 flex-shrink-0" />
              <p>Profile updated successfully!</p>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
};
