import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { User } from '@/types/type';

export const findOrCreateChat = async (currentUser: User, otherUser: User) => {
  if (!currentUser?.id || !otherUser?.id) {
    console.error('Missing required user IDs:', { currentUser: currentUser?.id, otherUser: otherUser?.id });
    return null;
  }

  try {
    // Check if chat already exists
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', currentUser.id)
    );
    
    const querySnapshot = await getDocs(q);
    const existingChat = querySnapshot.docs.find(doc => {
      const data = doc.data();
      return data.participants?.includes(otherUser.id);
    });

    if (existingChat) {
      return existingChat.id;
    }

    // Create new chat if none exists
    const chatData = {
      participants: [currentUser.id, otherUser.id],
      lastMessage: null,
      lastMessageTime: serverTimestamp(),
      unreadCount: {
        [currentUser.id]: 0,
        [otherUser.id]: 0
      },
      name: otherUser.fullName || otherUser.firstName || 'Chat',
      avatar: otherUser.imageUrl || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      metadata: {
        [currentUser.id]: {
          name: currentUser.fullName || currentUser.firstName || 'User',
          avatar: currentUser.imageUrl || ''
        },
        [otherUser.id]: {
          name: otherUser.fullName || otherUser.firstName || 'Driver',
          avatar: otherUser.imageUrl || ''
        }
      }
    };

    // Log the data being sent to Firestore
    console.log('Creating new chat with data:', JSON.stringify(chatData, null, 2));

    const chatRef = await addDoc(chatsRef, chatData);
    return chatRef.id;
  } catch (error) {
    console.error('Error finding/creating chat:', error);
    return null;
  }
};