import React from 'react';
import { format } from 'date-fns';
import { Check, CheckCheck, Trash2 } from 'lucide-react';
import { ChatUser } from './ChatLayout';

interface ContactItemProps {
  contact: ChatUser;
  selectedUser: ChatUser | null;
  currentUser: any;
  onSelect: (user: ChatUser) => void;
  onRemove: (user: ChatUser) => void;
}

export const ContactItem: React.FC<ContactItemProps> = React.memo(({ 
  contact, 
  selectedUser, 
  currentUser, 
  onSelect, 
  onRemove 
}) => {
  return (
    <div
      className={`w-full flex items-center gap-4 px-4 py-3 transition-colors group cursor-pointer ${
        selectedUser?.uid === contact.uid ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
      onClick={() => onSelect(contact)}
    >
      <div className="relative">
        <img 
          src={contact.photoURL || `https://ui-avatars.com/api/?name=${contact.displayName}&background=random`} 
          alt={contact.displayName} 
          className="w-12 h-12 rounded-full object-cover shadow-sm"
          referrerPolicy="no-referrer"
        />
        {contact.status === 'online' && (
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>
        )}
      </div>
      <div className="flex-1 text-left border-b border-gray-50 pb-3 pt-1 overflow-hidden">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 text-[15px] truncate">{contact.displayName}</h3>
          {contact.lastMessage && (
            <span className="text-[10px] text-gray-400 ml-2 whitespace-nowrap">
              {contact.lastMessage.timestamp?.toDate ? format(contact.lastMessage.timestamp.toDate(), 'HH:mm') : ''}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <div className={`text-sm truncate flex-1 ${contact.unreadCount && contact.unreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
            {contact.lastMessage ? (
              <div className="flex items-center gap-1 overflow-hidden">
                {contact.lastMessage.senderId === currentUser.uid && (
                  <div className="flex-shrink-0">
                    {contact.lastMessage.read ? (
                      <CheckCheck className="w-3 h-3 text-blue-500" />
                    ) : (
                      <Check className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                )}
                <span className="truncate">{contact.lastMessage.text}</span>
              </div>
            ) : (
              `@${contact.username || contact.email.split('@')[0]}`
            )}
          </div>
          {contact.unreadCount && contact.unreadCount > 0 ? (
            <span className="ml-2 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {contact.unreadCount}
            </span>
          ) : contact.status === 'online' ? (
            <span className="text-[10px] font-medium text-green-500 uppercase tracking-wider ml-2">Online</span>
          ) : null}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(contact);
        }}
        className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove Contact"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
});

ContactItem.displayName = 'ContactItem';
