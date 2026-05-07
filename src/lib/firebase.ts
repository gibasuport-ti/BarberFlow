import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, limit, getDocs } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Log para depuração (visível no console do navegador)
console.log("Firebase: Carregando configuração para o projeto:", firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

// Tipos
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  role: 'customer' | 'admin';
  createdAt: any;
}

export interface BarberService {
  id: string;
  name: string;
  price: number;
  duration: number;
  description: string;
  imageUrl: string;
}

export interface Appointment {
  id: string;
  userId: string;
  userName: string;
  serviceId: string;
  serviceName: string;
  date: Date;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: any;
}

export interface QueueItem {
  id: string;
  userId: string;
  userName: string;
  joinedAt: any;
  status: 'waiting' | 'serving' | 'finished';
}

// Erros do Firestore (conforme exigido pelas instruções)
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
