import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { HelpCircle, MessageCircle, ShieldCheck, Send, CircleCheck, ChevronDown, ChevronUp, Clock, AlertCircle, ThumbsUp, Star } from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

const FAQ_ITEMS = [
  {
    question: "How do I change my profile picture?",
    answer: "Go to Settings (gear icon in the sidebar) and click on your current profile picture to upload a new one."
  },
  {
    question: "Are my messages encrypted?",
    answer: "Yes, messages are end-to-end encrypted before being stored in our database, ensuring only you and the recipient can read them."
  },
  {
    question: "How do I block a user?",
    answer: "Open a chat with the user, click the three dots in the top right, and select 'Block User'. You can also remove them from your contacts."
  },
  {
    question: "Can I delete messages?",
    answer: "Yes, you can delete messages you've sent by hovering over them and clicking the trash can icon. You can also clear the entire chat history."
  },
  {
    question: "What is 'Compact View'?",
    answer: "Compact View reduces the spacing between messages and UI elements, allowing you to see more content on the screen at once. You can enable it in Settings."
  },
  {
    question: "How do I star a message?",
    answer: "Hover over any message and click the star icon. Starred messages are saved for quick reference."
  }
];

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [view, setView] = useState<'menu' | 'ticket' | 'history' | 'faq' | 'feedback' | 'success'>('menu');
  const [message, setMessage] = useState('');
  const [feedbackType, setFeedbackType] = useState('suggestion');
  const [priority, setPriority] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    if (view === 'history' && isOpen) {
      fetchTickets();
    }
  }, [view, isOpen]);

  const fetchTickets = async () => {
    setIsLoadingTickets(true);
    try {
      const q = query(
        collection(db, 'support_tickets'),
        where('uid', '==', currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const fetchedTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client-side to avoid needing a composite index
      fetchedTickets.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
      setTickets(fetchedTickets);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      toast.error('Failed to load ticket history');
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please describe your issue.');
      return;
    }
    if (message.trim().length < 10) {
      setError('Please provide a bit more detail (at least 10 characters).');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      if (view === 'feedback') {
        await addDoc(collection(db, 'feedback'), {
          uid: currentUser.uid,
          email: currentUser.email || 'unknown@example.com',
          message: message.trim(),
          type: feedbackType,
          createdAt: serverTimestamp()
        });
        toast.success('Feedback sent. Thank you!');
      } else {
        await addDoc(collection(db, 'support_tickets'), {
          uid: currentUser.uid,
          email: currentUser.email || 'unknown@example.com',
          message: message.trim(),
          priority,
          status: 'open',
          createdAt: serverTimestamp()
        });
        toast.success('Ticket submitted successfully!');
      }
      setView('success');
      setMessage('');
      setPriority('normal');
    } catch (err) {
      console.error('Error submitting:', err);
      setError('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setView('menu');
      setMessage('');
      setError('');
      setOpenFaqIndex(null);
    }, 300);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        view === 'menu' ? 'Help & Support' : 
        view === 'ticket' ? 'Contact Support' : 
        view === 'feedback' ? 'Send Feedback' :
        view === 'history' ? 'My Tickets' :
        view === 'faq' ? 'FAQ' :
        'Ticket Submitted'
      }
      footer={
        view === 'menu' ? (
          <button onClick={handleClose} className="px-4 py-2 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors w-full">
            Close
          </button>
        ) : (view === 'ticket' || view === 'feedback') ? (
          <div className="flex gap-2 w-full">
            <button onClick={() => setView('menu')} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors flex-1" disabled={isSubmitting}>
              Back
            </button>
            <button onClick={handleSubmitTicket} disabled={!message.trim() || isSubmitting} className={`px-4 py-2 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex-1 flex items-center justify-center gap-2 ${view === 'feedback' ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'}`}>
              {isSubmitting ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4" /> Submit</>
              )}
            </button>
          </div>
        ) : view === 'success' ? (
          <div className="flex gap-2 w-full">
            <button onClick={() => setView('history')} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors flex-1">
              View Tickets
            </button>
            <button onClick={handleClose} className="px-4 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors flex-1">
              Done
            </button>
          </div>
        ) : (
          <button onClick={() => setView('menu')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors w-full">
            Back to Menu
          </button>
        )
      }
    >
      <div className="space-y-4">
        {view === 'menu' && (
          <>
            <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100/50">
              <div className="bg-blue-500 p-2 rounded-xl shadow-sm">
                <HelpCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-900">How can we help?</p>
                <p className="text-xs text-blue-700/80 mt-1 leading-relaxed">Find answers to common questions or reach out to our support team directly.</p>
              </div>
            </div>
            
            <div className="grid gap-2">
              <button onClick={() => setView('faq')} className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl hover:bg-gray-50 hover:border-gray-200 transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                    <HelpCircle className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-gray-900">FAQ</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Frequently asked questions</span>
                  </div>
                </div>
              </button>

              <button onClick={() => setView('ticket')} className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl hover:bg-gray-50 hover:border-gray-200 transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                    <MessageCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-gray-900">Contact Support</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Send a message to our team</span>
                  </div>
                </div>
              </button>

              <button onClick={() => setView('feedback')} className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl hover:bg-gray-50 hover:border-gray-200 transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                    <ThumbsUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-gray-900">Send Feedback</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Help us improve the app</span>
                  </div>
                </div>
              </button>
              
              <button onClick={() => setView('history')} className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl hover:bg-gray-50 hover:border-gray-200 transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Clock className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-gray-900">My Tickets</span>
                    <span className="block text-xs text-gray-500 mt-0.5">View your past support requests</span>
                  </div>
                </div>
              </button>
            </div>
          </>
        )}

        {view === 'faq' && (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {FAQ_ITEMS.map((item, index) => (
              <div key={index} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left bg-white hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">{item.question}</span>
                  {openFaqIndex === index ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
                {openFaqIndex === index && (
                  <div className="p-4 pt-0 text-sm text-gray-600 bg-gray-50/50 border-t border-gray-50">
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {view === 'history' && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {isLoadingTickets ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-8 text-gray-500 flex flex-col items-center">
                <MessageCircle className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-sm font-medium">No tickets found</p>
                <p className="text-xs mt-1">You haven't submitted any support requests yet.</p>
              </div>
            ) : (
              tickets.map(ticket => (
                <div key={ticket.id} className="p-4 border border-gray-100 rounded-xl bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                      ticket.status === 'open' ? 'bg-green-100 text-green-700' : 
                      ticket.status === 'in-progress' ? 'bg-yellow-100 text-yellow-700' : 
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {ticket.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {ticket.createdAt ? format(ticket.createdAt.toDate(), 'MMM d, yyyy') : 'Just now'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 line-clamp-2">{ticket.message}</p>
                </div>
              ))
            )}
          </div>
        )}

        {view === 'feedback' && (
          <div className="space-y-4">
            <div className="bg-green-50 p-3 rounded-xl flex items-start gap-2 border border-green-100">
              <ThumbsUp className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <p className="text-xs text-green-800">
                Your feedback helps us make the app better for everyone.
              </p>
            </div>
            
            <div className="flex gap-2">
              {['suggestion', 'bug', 'compliment'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFeedbackType(type)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium capitalize transition-all ${
                    feedbackType === type 
                      ? 'bg-green-500 text-white shadow-sm' 
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700 ml-1">Your Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's on your mind..."
                className="w-full h-32 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-sm"
                autoFocus
              />
            </div>
          </div>
        )}

        {view === 'ticket' && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-xl flex items-start gap-2 border border-blue-100">
              <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-800">
                Please provide as much detail as possible so we can help you faster.
              </p>
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700 ml-1">Priority</label>
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm appearance-none"
              >
                <option value="low">Low - General Question</option>
                <option value="normal">Normal - Issue or Bug</option>
                <option value="high">High - Cannot access account</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700 ml-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue..."
                className="w-full h-32 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                autoFocus
              />
            </div>
          </div>
        )}

        {view === 'success' && (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-4 animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-2">
              <CircleCheck className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Ticket Submitted</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-[280px] mx-auto leading-relaxed">
                Thank you for reaching out. Our support team will review your request and contact you at <span className="font-medium text-gray-900">{currentUser.email}</span>.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
