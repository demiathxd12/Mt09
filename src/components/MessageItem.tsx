import React, { useState } from 'react';
import { format } from 'date-fns';
import { Check, CheckCheck, Trash2, Pencil, X, Reply, Copy, Share2, Star, Forward, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';

interface MessageItemProps {
  msg: any;
  isMe: boolean;
  selectedUser: any;
  onReaction: (messageId: string, emoji: string) => void;
  onDelete: (messageId: string) => void;
  onEdit: (message: any) => void;
  onReply: (message: any) => void;
  onStar: (messageId: string) => void;
  onForward: (message: any) => void;
  isStarred: boolean;
  settings?: any;
}

export const MessageItem: React.FC<MessageItemProps> = React.memo(({ 
  msg, 
  isMe, 
  selectedUser, 
  onReaction, 
  onDelete, 
  onEdit,
  onReply,
  onStar,
  onForward,
  isStarred,
  settings
}) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  const getBubbleStyle = () => {
    const base = isMe 
      ? `text-white` 
      : 'bg-white text-gray-800 shadow-sm border border-gray-100';
    
    const radius = settings?.bubbleStyle === 'sharp' 
      ? 'rounded-lg' 
      : settings?.bubbleStyle === 'minimal' 
        ? 'rounded-3xl' 
        : isMe ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm';

    const fontSize = settings?.fontSize === 'small' ? 'text-xs' :
                     settings?.fontSize === 'large' ? 'text-base' :
                     settings?.fontSize === 'xlarge' ? 'text-lg' : 'text-[14.5px]';

    return { 
      className: `px-4 py-2.5 shadow-sm transition-all relative ${base} ${radius} ${fontSize}`,
      style: isMe ? { backgroundColor: settings?.accentColor || '#3b82f6' } : {}
    };
  };

  const handleCopy = () => {
    if (msg.text) {
      navigator.clipboard.writeText(msg.text);
      toast.success('Message copied!');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Message from SecureChat',
          text: msg.text || 'Shared media',
          url: msg.imageUrl || msg.audioUrl || window.location.href,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      handleCopy();
    }
  };

  if (msg.type === 'system') {
    return (
      <div className="flex justify-center my-4 w-full">
        <div className="bg-gray-100/50 backdrop-blur-sm px-4 py-1.5 rounded-full border border-gray-200/50">
          <p className="text-[11px] font-medium text-gray-500 text-center uppercase tracking-wider">
            {msg.text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4 group`}
      >
        <div className={`max-w-[85%] md:max-w-[70%] relative ${isMe ? 'order-1' : 'order-2'}`}>
          {/* Message Bubble */}
          <div {...getBubbleStyle()}>
            {/* Message Actions Overlay */}
            <div className={`
              absolute top-0 ${isMe ? '-left-12' : '-right-12'} 
              opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1
            `}>
              <button 
                onClick={() => setShowReactions(!showReactions)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
                title="React"
              >
                <Smile className="w-4 h-4" />
              </button>
              {showReactions && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`absolute bottom-full ${isMe ? 'right-0' : 'left-0'} mb-2 p-1 bg-white rounded-full shadow-lg border border-gray-100 flex gap-1 z-50`}
                >
                  {emojis.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReaction(msg.id, emoji);
                        setShowReactions(false);
                      }}
                      className="p-1.5 hover:bg-gray-50 rounded-full transition-colors text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </motion.div>
              )}
              <button 
                onClick={() => onStar(msg.id)}
                className={`p-1.5 rounded-full hover:bg-gray-100 ${isStarred ? 'text-yellow-500' : 'text-gray-400'}`}
                title={isStarred ? "Unstar" : "Star"}
              >
                <Star className={`w-4 h-4 ${isStarred ? 'fill-current' : ''}`} />
              </button>
              <button 
                onClick={() => onForward(msg)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
                title="Forward"
              >
                <Forward className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onReply(msg)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
                title="Reply"
              >
                <Reply className="w-4 h-4" />
              </button>
            </div>

            {msg.forwardedFrom && (
              <div className="flex items-center gap-1 mb-1 opacity-70">
                <Forward className="w-3 h-3" />
                <span className="text-[10px] font-medium italic">Forwarded from {msg.forwardedFrom}</span>
              </div>
            )}
            {msg.replyTo && (
              <div className={`mb-2 p-2 rounded-lg text-sm border-l-4 ${isMe ? 'bg-blue-600/30 border-blue-200 text-white' : 'bg-gray-100 border-gray-300 text-gray-800'}`}>
                <p className="font-semibold text-xs opacity-80 mb-0.5">{msg.replyTo.senderName}</p>
                <p className="truncate opacity-90">{msg.replyTo.text || '📷 Image'}</p>
              </div>
            )}
            {msg.imageUrl && (
              <img 
                src={msg.imageUrl} 
                alt="Sent image" 
                className="rounded-lg mb-2 max-w-full h-auto cursor-pointer hover:opacity-95 transition-opacity object-cover max-h-64"
                onClick={() => setIsLightboxOpen(true)}
                loading="lazy"
              />
            )}
            {msg.text && (
              <div className={`text-[15px] leading-relaxed break-words whitespace-pre-wrap prose ${isMe ? 'prose-invert' : ''} max-w-none prose-p:my-0 prose-pre:my-1 prose-pre:bg-black/10 prose-pre:text-inherit`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.text}
                </ReactMarkdown>
              </div>
            )}
            
            {/* Reactions */}
            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
              <div className={`absolute -bottom-3 ${isMe ? 'right-2' : 'left-2'} flex flex-wrap gap-1 z-10`}>
                {Object.entries(msg.reactions).map(([emoji, uids]: [string, any]) => (
                  <button
                    key={emoji}
                    onClick={() => onReaction(msg.id, emoji)}
                    className={`border rounded-full px-1.5 py-0.5 text-[11px] shadow-sm transition-colors flex items-center gap-1
                      ${uids.includes(isMe ? msg.senderId : msg.receiverId) 
                        ? 'bg-blue-50 border-blue-200 text-blue-700' 
                        : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-700'}`}
                  >
                    <span>{emoji}</span>
                    {uids.length > 1 && <span className="font-medium">{uids.length}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions Overlay */}
          <div className={`
            absolute top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full shadow-md border border-gray-100 opacity-0 group-hover:opacity-100 transition-all z-20
            ${isMe ? 'right-full mr-2' : 'left-full ml-2'}
          `}>
            <button onClick={() => onReaction(msg.id, '❤️')} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors hover:bg-red-50 rounded-full" title="Love">❤️</button>
            <button onClick={() => onReaction(msg.id, '👍')} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors hover:bg-blue-50 rounded-full" title="Like">👍</button>
            <button onClick={() => onReaction(msg.id, '😂')} className="p-1.5 text-gray-400 hover:text-yellow-500 transition-colors hover:bg-yellow-50 rounded-full" title="Haha">😂</button>
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <button onClick={() => onReply(msg)} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors hover:bg-blue-50 rounded-full" title="Reply">
              <Reply className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleCopy} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors hover:bg-blue-50 rounded-full" title="Copy">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleShare} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors hover:bg-blue-50 rounded-full" title="Share">
              <Share2 className="w-3.5 h-3.5" />
            </button>
            {isMe && (
              <>
                <button onClick={() => onEdit(msg)} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors hover:bg-blue-50 rounded-full" title="Edit message">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(msg.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors hover:bg-red-50 rounded-full" title="Delete message">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Timestamp & Status */}
          <div className={`flex items-center gap-1 mt-1.5 px-1 ${isMe ? 'justify-end' : 'justify-start'} ${msg.reactions && Object.keys(msg.reactions).length > 0 ? 'mt-3' : ''}`}>
            {msg.edited && (
              <span className="text-[10px] text-gray-400 italic mr-1">Edited</span>
            )}
            <span className="text-[10px] text-gray-400 font-medium">
              {msg.timestamp?.toDate ? format(msg.timestamp.toDate(), 'h:mm a') : 'Sending...'}
            </span>
            {isMe && msg.timestamp && (
              <div className="flex items-center ml-0.5">
                {msg.read ? (
                  <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-gray-400" />
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {isLightboxOpen && msg.imageUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8"
            onClick={() => setIsLightboxOpen(false)}
          >
            <button 
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setIsLightboxOpen(false); }}
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={msg.imageUrl} 
              alt="Enlarged view" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

MessageItem.displayName = 'MessageItem';
