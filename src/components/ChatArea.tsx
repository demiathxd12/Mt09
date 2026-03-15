import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, writeBatch, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ChatUser } from './ChatLayout';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, Image as ImageIcon, X, Trash2, MoreVertical, UserMinus, AlertCircle, Check, CheckCheck, Search, Pencil, ChevronDown, ShieldCheck, Palette, HelpCircle, MessageCircle, Download, MapPin, Paperclip, Square, ShieldAlert, AlertTriangle } from 'lucide-react';
import { format, isSameDay, isYesterday, isToday } from 'date-fns';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { Modal } from './Modal';
import { SupportModal } from './SupportModal';
import { encryptMessage, decryptMessage } from '../utils/crypto';
import { MessageItem } from './MessageItem';
import imageCompression from 'browser-image-compression';
import toast from 'react-hot-toast';

interface ChatAreaProps {
  selectedUser: ChatUser;
  currentUser: User;
  onBack: () => void;
}

interface Message {
  id: string;
  text: string;
  imageUrl?: string;
  senderId: string;
  receiverId: string;
  timestamp: any;
  chatId: string;
  read?: boolean;
  reactions?: { [emoji: string]: string[] };
  expiresAt?: number;
  edited?: boolean;
  editedAt?: any;
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
}

export const ChatArea: React.FC<ChatAreaProps> = ({ selectedUser, currentUser, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRemoveContactModal, setShowRemoveContactModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemovingContact, setIsRemovingContact] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [userSettings, setUserSettings] = useState<any>(null);
  const userSettingsRef = useRef<any>(null);
  const [liveSelectedUser, setLiveSelectedUser] = useState<ChatUser>(selectedUser);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);
  const [starredMessages, setStarredMessages] = useState<string[]>([]);
  const [forwardingMessage, setForwardingMessage] = useState<any>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [disappearingMode, setDisappearingMode] = useState<number | null>(null); // null, 3600 (1h), 86400 (1d), 604800 (1w)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialLoadRef = useRef(true);
  const optionsRef = useRef<HTMLDivElement>(null);

  const chatId = [currentUser.uid, selectedUser.uid].sort().join('_');

  useEffect(() => {
    // Listen for live updates to the selected user's status
    const unsubUser = onSnapshot(doc(db, 'users', selectedUser.uid), (doc) => {
      if (doc.exists()) {
        setLiveSelectedUser({ ...selectedUser, ...doc.data() } as ChatUser);
      }
    });
    return () => unsubUser();
  }, [selectedUser.uid]);

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Close options menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Fetch user settings for personalization
    const unsubSettings = onSnapshot(doc(db, 'users', currentUser.uid), (doc) => {
      if (doc.exists()) {
        const settings = doc.data().settings || { theme: 'light', wallpaper: 'default' };
        setUserSettings(settings);
        userSettingsRef.current = settings;
      }
    });

    // Listen for chat settings (disappearing messages)
    const unsubChatSettings = onSnapshot(doc(db, 'chats', chatId), (doc) => {
      if (doc.exists()) {
        setDisappearingMode(doc.data().disappearingMode || null);
      }
    });

    return () => {
      unsubSettings();
      unsubChatSettings();
    };
  }, [currentUser.uid, chatId]);

  useEffect(() => {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const msgs: Message[] = [];
      
      // Decrypt messages in parallel
      const decryptedMsgs = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        let text = data.text || '';
        if (text && data.isEncrypted) {
          text = await decryptMessage(text, chatId);
        }
        return { id: doc.id, ...data, text } as Message;
      }));
      
      // Check for new messages for notifications
      if (!initialLoadRef.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newMsg = change.doc.data() as Message;
            if (newMsg.senderId !== currentUser.uid) {
              if ('vibrate' in navigator) {
                navigator.vibrate([100, 50, 100]); // Vibrate pattern
              }
              if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(selectedUser.displayName, {
                  body: newMsg.text ? 'Sent a secure message' : (newMsg.imageUrl ? 'Sent an image' : 'Sent a voice message'),
                  icon: selectedUser.photoURL || '/vite.svg'
                });
              }
            }
          }
        });
      }
      
      setMessages(decryptedMsgs);

      // Handle disappearing messages
      const now = Date.now();
      decryptedMsgs.forEach(async (m) => {
        if (m.expiresAt && m.expiresAt < now) {
          try {
            await deleteDoc(doc(db, 'chats', chatId, 'messages', m.id));
          } catch (e) {
            console.error("Error auto-deleting message:", e);
          }
        }
      });
      
      // Mark unread messages as read
      const unreadMessages = decryptedMsgs.filter(m => m.senderId !== currentUser.uid && !m.read && m.timestamp);
      if (unreadMessages.length > 0 && (!userSettingsRef.current || userSettingsRef.current.readReceipts !== false)) {
        const batch = writeBatch(db);
        unreadMessages.forEach(m => {
          batch.update(doc(db, 'chats', chatId, 'messages', m.id), { read: true });
        });
        batch.commit().catch(err => console.error("Error marking as read:", err));
      }
      
      if (initialLoadRef.current) {
        setTimeout(() => {
          scrollToBottom('auto');
          initialLoadRef.current = false;
        }, 100);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => unsubscribe();
  }, [chatId, currentUser.uid, selectedUser.displayName, selectedUser.photoURL]);

  useEffect(() => {
    // Listen for typing indicator
    const typingRef = doc(db, 'chats', chatId, 'typing', selectedUser.uid);
    const unsubscribe = onSnapshot(typingRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const lastTyped = data.timestamp?.toDate?.() || new Date();
        const now = new Date();
        // Only show if typed in the last 5 seconds
        if (data.isTyping && (now.getTime() - lastTyped.getTime() < 5000)) {
          setOtherUserTyping(true);
        } else {
          setOtherUserTyping(false);
        }
      } else {
        setOtherUserTyping(false);
      }
    });

    return () => unsubscribe();
  }, [chatId, selectedUser.uid]);

  const handleReaction = React.useCallback(async (messageId: string, emoji: string) => {
    try {
      const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
      const msg = messages.find(m => m.id === messageId);
      if (!msg) return;

      const reactions = { ...(msg as any).reactions || {} };
      if (reactions[emoji]?.includes(currentUser.uid)) {
        reactions[emoji] = reactions[emoji].filter((id: string) => id !== currentUser.uid);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        if (!reactions[emoji]) reactions[emoji] = [];
        reactions[emoji].push(currentUser.uid);
      }

      await setDoc(msgRef, { reactions }, { merge: true });
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  }, [chatId, currentUser.uid, messages]);

  const handleDeleteMessage = React.useCallback(async (messageId: string) => {
    try {
      await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  }, [chatId]);

  const handleStartEdit = React.useCallback((message: Message) => {
    setEditingMessageId(message.id);
    setEditingText(message.text);
  }, []);

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingText.trim()) return;
    try {
      const encryptedText = await encryptMessage(editingText.trim(), chatId);
      const msgRef = doc(db, 'chats', chatId, 'messages', editingMessageId);
      await setDoc(msgRef, { 
        text: encryptedText,
        isEncrypted: true,
        edited: true,
        editedAt: serverTimestamp()
      }, { merge: true });
      setEditingMessageId(null);
      setEditingText('');
    } catch (error) {
      console.error("Error editing message:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isScrolledUp = scrollHeight - scrollTop - clientHeight > 300;
      setShowScrollButton(isScrolledUp);
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (!showScrollButton) {
      scrollToBottom(initialLoadRef.current ? 'auto' : 'smooth');
    }
  }, [messages]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true
      };
      const compressedFile = await imageCompression(file, options);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Error compressing image:', error);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true
      };
      const compressedFile = await imageCompression(file, options);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Error compressing image:', error);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const handleTyping = async () => {
    if (!isTyping) {
      setIsTyping(true);
      const chatId = [currentUser.uid, selectedUser.uid].sort().join('_');
      await setDoc(doc(db, 'chats', chatId, 'typing', currentUser.uid), {
        isTyping: true,
        lastTyped: Date.now()
      }, { merge: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(async () => {
      setIsTyping(false);
      const chatId = [currentUser.uid, selectedUser.uid].sort().join('_');
      await setDoc(doc(db, 'chats', chatId, 'typing', currentUser.uid), {
        isTyping: false,
        lastTyped: Date.now()
      }, { merge: true });
    }, 3000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedImage) || isUploading) return;

    const messageText = newMessage.trim();
    const imageToSend = selectedImage;
    const replyData = replyingTo;
    
    setNewMessage('');
    setSelectedImage(null);
    setReplyingTo(null);
    setIsUploading(true);

    try {
      if (!currentUser || !selectedUser) throw new Error('User not authenticated');

      const encryptedText = messageText ? await encryptMessage(messageText, chatId) : '';
      const expiresAt = disappearingMode ? Date.now() + (Number(disappearingMode) * 1000) : null;
      
      const messageData: any = {
        chatId,
        senderId: currentUser.uid,
        receiverId: selectedUser.uid,
        participants: [currentUser.uid, selectedUser.uid],
        text: encryptedText,
        isEncrypted: !!messageText,
        timestamp: serverTimestamp(),
        expiresAt,
        read: false
      };

      if (imageToSend) {
        messageData.imageUrl = imageToSend;
      }

      if (replyData) {
        messageData.replyTo = {
          id: replyData.id,
          text: replyData.text,
          senderName: replyData.senderId === currentUser.uid ? 'You' : selectedUser.displayName
        };
      }

      await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
      scrollToBottom();
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message. Please try again.");
      handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}/messages`);
      // Restore the message text if it failed
      setNewMessage(messageText);
      setSelectedImage(imageToSend);
      setReplyingTo(replyData);
    } finally {
      setIsUploading(false);
    }
  };

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const locationUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        
        try {
          const encryptedText = await encryptMessage(`📍 My Location: ${locationUrl}`, chatId);
          await addDoc(collection(db, 'chats', chatId, 'messages'), {
            chatId,
            senderId: currentUser.uid,
            receiverId: selectedUser.uid,
            participants: [currentUser.uid, selectedUser.uid],
            text: encryptedText,
            isEncrypted: true,
            timestamp: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'messages');
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to retrieve your location');
      }
    );
  };

  const handleClearChat = async () => {
    try {
      const q = query(collection(db, 'chats', chatId, 'messages'));
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      setShowDeleteModal(false);
      setShowOptions(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'messages');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportChat = () => {
    const chatText = messages.map(msg => {
      const time = msg.timestamp?.toDate ? format(msg.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'Unknown time';
      const sender = msg.senderId === currentUser.uid ? 'You' : selectedUser.displayName;
      return `[${time}] ${sender}: ${msg.text || (msg.imageUrl ? '[Image]' : '')}`;
    }).join('\n');

    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_with_${selectedUser.displayName.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowOptions(false);
  };

  const handleRemoveContact = async () => {
    setIsRemovingContact(true);
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'contacts', selectedUser.uid));
      setShowRemoveContactModal(false);
      setShowOptions(false);
      onBack(); // Go back to the chat list
    } catch (error) {
      console.error("Error removing contact:", error);
    } finally {
      setIsRemovingContact(false);
    }
  };

  const handleStarMessage = async (messageId: string) => {
    try {
      const starRef = doc(db, 'users', currentUser.uid, 'starred', messageId);
      if (starredMessages.includes(messageId)) {
        await deleteDoc(starRef);
        setStarredMessages(prev => prev.filter(id => id !== messageId));
        toast.success('Message unstarred');
      } else {
        await setDoc(starRef, { starredAt: serverTimestamp() });
        setStarredMessages(prev => [...prev, messageId]);
        toast.success('Message starred');
      }
    } catch (error) {
      console.error("Error starring message:", error);
    }
  };

  const handleForwardMessage = (message: any) => {
    setForwardingMessage(message);
    setShowForwardModal(true);
  };

  const confirmForward = async (targetUser: ChatUser) => {
    if (!forwardingMessage) return;
    try {
      const targetChatId = [currentUser.uid, targetUser.uid].sort().join('_');
      
      // Decrypt first if it was encrypted for the current chat
      let text = forwardingMessage.text;
      if (forwardingMessage.isEncrypted && text) {
        text = await decryptMessage(text, chatId);
      }
      
      // Re-encrypt for the target chat if it's text
      let encryptedText = text;
      if (text) {
        encryptedText = await encryptMessage(text, targetChatId);
      }

      const messageData = {
        chatId: targetChatId,
        senderId: currentUser.uid,
        receiverId: targetUser.uid,
        participants: [currentUser.uid, targetUser.uid],
        text: encryptedText || '',
        isEncrypted: !!text,
        imageUrl: forwardingMessage.imageUrl || null,
        timestamp: serverTimestamp(),
        read: false,
        type: forwardingMessage.imageUrl ? 'image' : 'text',
        forwardedFrom: currentUser.displayName
      };
      
      await addDoc(collection(db, 'chats', targetChatId, 'messages'), messageData);
      setShowForwardModal(false);
      setForwardingMessage(null);
      toast.success(`Message forwarded to ${targetUser.displayName}`);
    } catch (error) {
      console.error("Error forwarding message:", error);
      toast.error("Failed to forward message");
    }
  };

  const toggleDisappearingMessages = async (seconds: number | null) => {
    try {
      await setDoc(doc(db, 'chats', chatId), {
        disappearingMode: seconds,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Send a system message
      const systemText = seconds 
        ? `${currentUser.displayName} set messages to disappear after ${seconds / 3600}h`
        : `${currentUser.displayName} turned off disappearing messages`;
        
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: currentUser.uid,
        receiverId: selectedUser.uid,
        participants: [currentUser.uid, selectedUser.uid],
        text: systemText,
        type: 'system',
        timestamp: serverTimestamp(),
        read: false
      });

      setShowOptions(false);
      toast.success(seconds ? `Disappearing messages set to ${seconds / 3600}h` : 'Disappearing messages turned off');
    } catch (error) {
      console.error("Error setting disappearing messages:", error);
    }
  };

  const handleBlockUser = async () => {
    setIsBlocking(true);
    try {
      await setDoc(doc(db, 'users', currentUser.uid, 'blocked', selectedUser.uid), {
        blockedAt: serverTimestamp(),
        displayName: selectedUser.displayName
      });
      toast.success(`${selectedUser.displayName} has been blocked`);
      setShowBlockModal(false);
      setShowOptions(false);
      onBack();
    } catch (error) {
      console.error("Error blocking user:", error);
      toast.error("Failed to block user");
    } finally {
      setIsBlocking(false);
    }
  };

  const handleReportUser = async () => {
    if (!reportReason.trim()) return;
    setIsReporting(true);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: currentUser.uid,
        reportedId: selectedUser.uid,
        reason: reportReason.trim(),
        chatId,
        timestamp: serverTimestamp()
      });
      toast.success('Report submitted. Thank you for helping keep our community safe.');
      setShowReportModal(false);
      setShowOptions(false);
      setReportReason('');
    } catch (error) {
      console.error("Error reporting user:", error);
      toast.error("Failed to submit report");
    } finally {
      setIsReporting(false);
    }
  };

  const filteredMessages = searchQuery.trim() 
    ? messages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const getWallpaperClass = () => {
    if (userSettings?.theme === 'dark' || userSettings?.theme === 'oled') return 'bg-[#0f0f0f]';
    
    switch (userSettings?.wallpaper) {
      case 'blue': return 'bg-blue-50';
      case 'green': return 'bg-green-50';
      case 'purple': return 'bg-purple-50';
      case 'dark': return 'bg-gray-900';
      case 'pattern': return 'bg-[#f5f5f7] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]';
      default: return 'bg-[#f5f5f7]';
    }
  };

  return (
    <div 
      className="flex flex-col h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Media Gallery Modal */}
      <Modal 
        isOpen={showMediaGallery} 
        onClose={() => setShowMediaGallery(false)} 
        title="Media Gallery"
      >
        <div className="grid grid-cols-3 gap-2 p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {messages.filter(m => m.imageUrl || (m as any).image).map(m => (
            <div key={m.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100 group cursor-pointer relative">
              <img 
                src={m.imageUrl || (m as any).image} 
                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                onClick={() => {
                  setSelectedGalleryImage(m.imageUrl || (m as any).image);
                }}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-[10px] text-white font-medium bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">
                  {m.timestamp ? format(m.timestamp.toDate(), 'MMM d') : ''}
                </span>
              </div>
            </div>
          ))}
          {messages.filter(m => m.imageUrl || (m as any).image).length === 0 && (
            <div className="col-span-3 py-12 text-center text-gray-400">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No media shared in this chat yet.</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Full Image View Modal */}
      <Modal
        isOpen={!!selectedGalleryImage}
        onClose={() => setSelectedGalleryImage(null)}
        title="View Image"
      >
        <div className="flex flex-col items-center">
          <img 
            src={selectedGalleryImage || ''} 
            alt="Full view" 
            className="max-w-full max-h-[70vh] rounded-lg shadow-lg"
            referrerPolicy="no-referrer"
          />
          <div className="mt-4 flex gap-4">
            <button
              onClick={() => {
                const a = document.createElement('a');
                a.href = selectedGalleryImage || '';
                a.download = `image_${Date.now()}.jpg`;
                a.click();
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      </Modal>

      {/* Block User Modal */}
      <Modal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        title="Block User"
        footer={
          <div className="flex gap-2 w-full">
            <button onClick={() => setShowBlockModal(false)} className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors">
              Cancel
            </button>
            <button 
              onClick={handleBlockUser} 
              disabled={isBlocking}
              className="flex-1 px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isBlocking ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Block User'}
            </button>
          </div>
        }
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Block {selectedUser.displayName}?</h3>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Blocked users will not be able to send you messages or see your status. This action can be undone in settings.
          </p>
        </div>
      </Modal>

      {/* Report User Modal */}
      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Report User"
        footer={
          <div className="flex gap-2 w-full">
            <button onClick={() => setShowReportModal(false)} className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors">
              Cancel
            </button>
            <button 
              onClick={handleReportUser} 
              disabled={isReporting || !reportReason.trim()}
              className="flex-1 px-4 py-2 bg-orange-500 text-white hover:bg-orange-600 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isReporting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Submit Report'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-orange-50 p-3 rounded-xl flex items-start gap-2 border border-orange-100">
            <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
            <p className="text-xs text-orange-800">
              Reporting helps us keep the community safe. Our team will review this user's behavior.
            </p>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700 ml-1">Reason for reporting</label>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Please describe why you are reporting this user..."
              className="w-full h-32 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none text-sm"
              autoFocus
            />
          </div>
        </div>
      </Modal>

      {/* Forward Modal */}
      <Modal
        isOpen={showForwardModal}
        onClose={() => setShowForwardModal(false)}
        title="Forward Message"
      >
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-500 mb-4">Select a contact to forward this message to:</p>
          <div className="text-center py-8 text-gray-400">
            Contact list for forwarding...
          </div>
        </div>
      </Modal>

      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-sm z-50 flex items-center justify-center border-4 border-blue-500 border-dashed m-4 rounded-3xl">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3">
            <ImageIcon className="w-12 h-12 text-blue-500" />
            <p className="text-lg font-semibold text-gray-800">Drop image to send</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="px-4 py-3 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="md:hidden p-2 mr-2 -ml-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <img 
          src={liveSelectedUser.photoURL || `https://ui-avatars.com/api/?name=${liveSelectedUser.displayName}&background=random`} 
          alt={liveSelectedUser.displayName} 
          className="w-10 h-10 rounded-full object-cover shadow-sm mr-3"
          referrerPolicy="no-referrer"
        />
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[17px] font-semibold text-gray-900 leading-tight">{liveSelectedUser.displayName}</h2>
            <div title="End-to-end encrypted">
              <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
            </div>
          </div>
          <div className="h-4 flex items-center">
            {otherUserTyping ? (
              <span className="text-xs text-blue-500 font-medium animate-pulse">typing...</span>
            ) : (
              <p className="text-xs text-gray-500">
                {liveSelectedUser.status === 'online' ? (
                  <span className="text-green-500 font-medium">Online</span>
                ) : (
                  <span>
                    Offline • {liveSelectedUser.lastSeen?.toDate ? `Last seen ${format(liveSelectedUser.lastSeen.toDate(), 'HH:mm')}` : 'Recently'}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-full transition-colors ${showSearch ? 'bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
            style={showSearch ? { color: userSettings?.accentColor || '#3b82f6', backgroundColor: `${userSettings?.accentColor || '#3b82f6'}15` } : {}}
            title="Search messages"
          >
            <Search className="w-5 h-5" />
          </button>
          <div className="relative" ref={optionsRef}>
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            title="Options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          {showOptions && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 animate-in fade-in slide-in-from-top-2">
              <button
                onClick={() => {
                  setShowOptions(false);
                  setShowSupportModal(true);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
              >
                <HelpCircle className="w-4 h-4 text-gray-400" />
                Help & Support
              </button>
              <button
                onClick={handleExportChat}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4 text-gray-400" />
                Export Chat
              </button>

              <div className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-t border-gray-50 mt-1">
                Disappearing Messages
              </div>
              <button
                onClick={() => toggleDisappearingMessages(null)}
                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${!disappearingMode ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                Off
                {!disappearingMode && <Check className="w-4 h-4" />}
              </button>
              <button
                onClick={() => toggleDisappearingMessages(3600)}
                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${disappearingMode === 3600 ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                1 Hour
                {disappearingMode === 3600 && <Check className="w-4 h-4" />}
              </button>
              <button
                onClick={() => toggleDisappearingMessages(86400)}
                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${disappearingMode === 86400 ? 'text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                1 Day
                {disappearingMode === 86400 && <Check className="w-4 h-4" />}
              </button>

              <div className="border-t border-gray-50 my-1"></div>
              <button
                onClick={() => {
                  setShowOptions(false);
                  setShowDeleteModal(true);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4 text-gray-400" />
                Clear Chat
              </button>
              <button
                onClick={() => setShowBlockModal(true)}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
              >
                <ShieldAlert className="w-4 h-4 text-red-500" />
                Block User
              </button>
              <button
                onClick={() => setShowReportModal(true)}
                className="w-full text-left px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-2 transition-colors"
              >
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Report User
              </button>
              <button
                onClick={handleRemoveContact}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
              >
                <UserMinus className="w-4 h-4 text-red-500" />
                Remove Contact
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Search Bar */}
      {showSearch && (
        <div className="px-4 py-2 bg-white border-b border-gray-100 animate-in slide-in-from-top duration-200">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search in conversation"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f5f5f7] text-sm rounded-lg pl-9 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto p-4 space-y-4 relative ${getWallpaperClass()}`}
        style={userSettings?.wallpaper && !['blue', 'green', 'purple', 'dark', 'pattern', 'default'].includes(userSettings.wallpaper) ? {
          backgroundImage: `url(${userSettings.wallpaper})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        } : {}}
      >
        {filteredMessages.length === 0 && searchQuery && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Search className="w-12 h-12 mb-2 opacity-20" />
            <p>No messages found matching "{searchQuery}"</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {filteredMessages.map((msg, index) => {
            const isMe = msg.senderId === currentUser.uid;
            const showAvatar = !isMe && (index === 0 || filteredMessages[index - 1].senderId !== msg.senderId);
            const reactions = (msg as any).reactions || {};
            
            // Date separator logic
            const showDateSeparator = index === 0 || !isSameDay(
              filteredMessages[index - 1].timestamp?.toDate() || new Date(),
              msg.timestamp?.toDate() || new Date()
            );

            const getDateLabel = (date: Date) => {
              if (isToday(date)) return 'Today';
              if (isYesterday(date)) return 'Yesterday';
              return format(date, 'MMMM d, yyyy');
            };
            
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                {showDateSeparator && msg.timestamp && (
                  <div className="flex justify-center my-6">
                    <span className="px-3 py-1 bg-gray-200/50 text-gray-500 text-[11px] font-medium rounded-full backdrop-blur-sm">
                      {getDateLabel(msg.timestamp.toDate())}
                    </span>
                  </div>
                )}
                <MessageItem 
                  msg={msg}
                  isMe={isMe}
                  selectedUser={selectedUser}
                  onReaction={handleReaction}
                  onDelete={handleDeleteMessage}
                  onEdit={handleStartEdit}
                  onReply={setReplyingTo}
                  onStar={handleStarMessage}
                  onForward={handleForwardMessage}
                  isStarred={starredMessages.includes(msg.id)}
                  settings={userSettings}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
        <AnimatePresence>
          {otherUserTyping && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2 text-gray-400 italic text-xs ml-10 py-2"
            >
              <div className="flex gap-1 bg-gray-100 px-2 py-1 rounded-full">
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="font-medium">{selectedUser.displayName}</span> is typing...
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
        
        {showScrollButton && (
          <button
            onClick={() => scrollToBottom()}
            className="fixed bottom-24 right-8 bg-white p-2 rounded-full shadow-lg border border-gray-100 hover:bg-gray-50 transition-all animate-in fade-in zoom-in z-20"
            style={{ color: userSettings?.accentColor || '#3b82f6' }}
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/80 backdrop-blur-md border-t border-gray-200">
        {replyingTo && (
          <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-start justify-between relative animate-in slide-in-from-bottom-2">
            <div className="flex-1 overflow-hidden border-l-4 border-blue-500 pl-3">
              <p className="text-xs font-semibold text-blue-600 mb-1">
                Replying to {replyingTo.senderId === currentUser.uid ? 'yourself' : selectedUser.displayName}
              </p>
              <p className="text-sm text-gray-600 truncate">{replyingTo.text || '📷 Image'}</p>
            </div>
            <button 
              onClick={() => setReplyingTo(null)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {selectedImage && (
          <div className="mb-3 relative inline-block">
            <img src={selectedImage} alt="Preview" className="h-24 rounded-xl border border-gray-200 shadow-sm object-cover" />
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full p-1 shadow-md hover:bg-gray-900 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-end gap-2 max-w-4xl mx-auto">
          <div className="flex-1 bg-gray-100 rounded-2xl border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all overflow-hidden flex items-center px-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-400 hover:text-blue-500 transition-colors rounded-full hover:bg-gray-100"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleShareLocation}
              className="p-2 text-gray-400 hover:text-blue-500 transition-colors rounded-full hover:bg-gray-100"
              title="Share Location"
            >
              <MapPin className="w-5 h-5" />
            </button>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImageSelect}
            />
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              placeholder="iMessage"
              className="w-full bg-transparent px-2 py-3 text-[15px] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={(!newMessage.trim() && !selectedImage) || isUploading}
            className={`p-3 rounded-full flex-shrink-0 transition-all ${
              (newMessage.trim() || selectedImage) && !isUploading
                ? 'text-white shadow-sm' 
                : 'bg-gray-100 text-gray-400'
            }`}
            style={(newMessage.trim() || selectedImage) && !isUploading ? { backgroundColor: userSettings?.accentColor || '#3b82f6' } : {}}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Clear Chat Modal */}
      {/* Support Modal */}
      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        currentUser={currentUser}
      />

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Clear Chat"
        footer={
          <>
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleClearChat}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Clearing...
                </>
              ) : (
                'Clear'
              )}
            </button>
          </>
        }
      >
        <p className="text-gray-600">
          Are you sure you want to clear all messages in this chat? This action cannot be undone.
        </p>
      </Modal>

      {/* Remove Contact Modal */}
      <Modal
        isOpen={showRemoveContactModal}
        onClose={() => setShowRemoveContactModal(false)}
        title="Remove Contact"
        footer={
          <>
            <button
              onClick={() => setShowRemoveContactModal(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRemoveContact}
              disabled={isRemovingContact}
              className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isRemovingContact ? (
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
          Are you sure you want to remove <span className="font-semibold text-gray-900">{selectedUser.displayName}</span> from your contacts?
        </p>
      </Modal>
    </div>
  );
};
