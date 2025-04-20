// lib/firebaseUser.ts
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const saveUserToFirestore = async (user: {
  id: string;                // Clerk ID
  name: string;
  email: string;
  phoneNumber: string;
  gender: string;
  workIndustry: string;
  clerkId: string;
}) => {
  try {
    // Use clerkId as the document ID
    await setDoc(doc(db, 'users', user.clerkId), {
      name: user.name,
      email: user.email,
      phone: user.phoneNumber,
      gender: user.gender,
      industry: user.workIndustry,
      clerkId: user.clerkId,
      createdAt: new Date().toISOString(),
    });

    console.log('✅ User data saved to Firestore with Clerk ID:', user.clerkId);
  } catch (error) {
    console.error('🔥 Error saving user data:', error);
    throw error; // Re-throw the error to handle it in the calling function
  }
};
