import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/lib/firebase';
import { useUser } from '@clerk/clerk-expo';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  getDoc,
  DocumentData
} from 'firebase/firestore';
import { sendRideStatusNotification } from '@/lib/notifications';
import type { Message, Chat, LastMessage } from '@/types/type';

interface Params {
  id: string;
  name: string;
  avatar: string;
}

export default function ConversationScreen() {
  const params = useLocalSearchParams<Params>();
  const chatId = params.id;
  const name = params.name;
  const avatar = params.avatar;
  
  const navigation = useNavigation();
  const { user } = useUser();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatData, setChatData] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [otherUserAvatar, setOtherUserAvatar] = useState<string | null>(null);

  // Get other user's avatar
  useEffect(() => {
    const getOtherUserAvatar = async () => {
      if (!chatData?.participants || !user?.id) return;
      
      const otherUserId = chatData.participants.find(id => id !== user.id);
      if (!otherUserId) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', otherUserId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setOtherUserAvatar(userData.profile_image_url || null);
        }
      } catch (error) {
        console.error('Error fetching user avatar:', error);
      }
    };

    getOtherUserAvatar();
  }, [chatData?.participants, user?.id]);

  // Listen to real-time message updates
  useEffect(() => {
    if (!chatId || !user?.id) return;

    setLoading(true);
    // Get messages for this chat
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList = snapshot.docs.map(doc => {
        const data = doc.data() as DocumentData;
        return {
          id: doc.id,
          text: data.text,
          senderId: data.senderId,
          senderName: data.senderName,
          timestamp: data.timestamp,
          sent: data.senderId === user.id
        } satisfies Message;
      });
      setMessages(messageList);
      setLoading(false);
      
      // Mark messages as read
      markMessagesAsRead();
    });

    // Get chat data
    const chatRef = doc(db, 'chats', chatId);
    const chatUnsubscribe = onSnapshot(chatRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as DocumentData;
        const metadata = data.metadata?.[user.id] || {};
        setChatData({
          id: doc.id,
          participants: data.participants || [],
          lastMessage: data.lastMessage || null,
          lastMessageTime: data.lastMessageTime,
          unreadCount: data.unreadCount || {},
          name: metadata.name || name,
          avatar: metadata.avatar || avatar
        });
      }
    });

    return () => {
      unsubscribe();
      chatUnsubscribe();
    };
  }, [chatId, user?.id]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => {
      showSubscription.remove();
    };
  }, []);

  const markMessagesAsRead = async () => {
    if (!chatId || !user?.id) return;

    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      [`unreadCount.${user.id}`]: 0
    });
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !chatId || !user?.id || !chatData) return;

    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const chatRef = doc(db, 'chats', chatId);

      // Create the message
      const messageData: Omit<Message, 'id'> = {
        text: newMessage,
        senderId: user.id,
        senderName: user.fullName || '',
        timestamp: serverTimestamp() as Timestamp,
      };

      // Add new message
      await addDoc(messagesRef, messageData);

      // Create last message data
      const lastMessage: LastMessage = {
        text: newMessage,
        senderId: user.id,
        senderName: user.fullName || '',
      };

      // Update chat metadata
      const updates: any = {
        lastMessage,
        lastMessageTime: serverTimestamp(),
      };

      // Add unread count updates and send notifications to other participants
      for (const participantId of chatData.participants.filter(id => id !== user.id)) {
        updates[`unreadCount.${participantId}`] = (chatData.unreadCount?.[participantId] || 0) + 1;
        
        // Send notification to the participant
        await sendRideStatusNotification(
          participantId,
          'New Message',
          `${user.fullName || 'Someone'}: ${newMessage}`,
          chatId
        );
      }

      await updateDoc(chatRef, updates);

      setNewMessage('');
      scrollRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <KeyboardAvoidingView
    className="flex-1 bg-white"
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
  >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-10 pb-3 border-b border-gray-200 ">
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            className="p-2"
          >
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
          {otherUserAvatar ? (
            <Image
              source={{ uri: otherUserAvatar }}
              className="w-10 h-10 rounded-full mx-3"
            />
          ) : (
            <View className="w-10 h-10 rounded-full bg-primary items-center justify-center mx-3">
              <Text className="text-lg font-semibold text-white">{name?.[0] || '?'}</Text>
            </View>
          )}
          <View>
            <Text className="text-base font-semibold text-black">{name}</Text>
            <Text className="text-xs text-gray-500">Active now</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4 py-2"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 10 }}
      >
        {loading ? (
          <View className="flex-1 justify-center items-center py-10">
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : messages.length === 0 ? (
          <View className="flex-1 justify-center items-center py-10">
            <Text className="text-gray-500 text-center">No messages yet. Start the conversation!</Text>
          </View>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              className={`mb-3  ${message.sent ? 'items-end' : 'items-start'}`}
            >
              <View
                className={`px-4 py-2 rounded-2xl max-w-[80%] ${
                  message.sent ? 'bg-primary-200 rounded-br-none' : 'bg-gray-100 rounded-bl-none'
                }`}
              >
                <Text className={`${message.sent ? 'text-black' : 'text-black'} text-sm`}>
                  {message.text}
                </Text>
              </View>
              <Text className="text-xs text-gray-400 mt-1">
                {message.timestamp?.toDate().toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit'
                })}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Input */}
      <View className="p-4 bg-white border-t border-gray-200">
        <View className="flex-row items-center bg-gray-50 rounded-full px-4 py-2">
          <TextInput
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            multiline
            className="flex-1 text-sm text-gray-700 px-2  max-h-20"
          />
          <TouchableOpacity 
            className="ml-2 bg-primary p-2 rounded-full"
            onPress={handleSend}
            disabled={!newMessage.trim()}
          >
            <Ionicons name="send" size={25} color="orange" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}