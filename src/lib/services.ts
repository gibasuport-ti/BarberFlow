import { auth, db, handleFirestoreError, UserProfile, BarberService, Appointment, QueueItem } from './firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  getDocs, 
  getDoc, 
  setDoc,
  deleteDoc,
  limit
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';

const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list' as any,
  GET: 'get' as any,
  WRITE: 'write' as any,
};

export const UserService = {
  async ensureProfile(user: FirebaseUser): Promise<UserProfile | null> {
    const userRef = doc(db, 'users', user.uid);
    try {
      console.log("UserService: Verificando perfil para", user.email);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        let profile = snap.data() as UserProfile;
        const admins = ['gibasuporte@gmail.com'];
        if (admins.includes(user.email || '') && profile.role !== 'admin') {
          console.log("UserService: Promovendo usuário a admin...");
          try {
            await updateDoc(userRef, { role: 'admin' });
            profile.role = 'admin';
            console.log("UserService: Promoção concluída localmente.");
          } catch (err: any) {
            console.error("UserService: Falha ao promover admin:", err);
            // Não falha o retorno se a promoção falhar por agora
          }
        }
        return profile;
      }
      
      console.log("UserService: Perfil não encontrado. Criando novo...");
      const admins = ['gibasuporte@gmail.com'];
      const isDefaultAdmin = admins.includes(user.email || '');
      const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
      const role = (usersSnap.empty || isDefaultAdmin) ? 'admin' : 'customer';
      
      const profile: UserProfile = {
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || "Cliente",
        email: user.email || "",
        photoURL: user.photoURL || "",
        role: role as 'admin' | 'customer',
        createdAt: serverTimestamp()
      };
      
      await setDoc(userRef, profile);
      console.log("UserService: Perfil criado com sucesso. Role:", role);
      return profile;
    } catch (e: any) {
      console.error("UserService: Erro ao gerenciar perfil:", e);
      handleFirestoreError(e, 'write' as any, `users/${user.uid}`);
      return null;
    }
  }
  };

export const BarberServices = {
  async getAll(): Promise<BarberService[]> {
    try {
      const snap = await getDocs(collection(db, 'services'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as BarberService));
    } catch (e) {
      console.error("BarberServices: Erro ao buscar serviços:", e);
      return [];
    }
  },

  async seed() {
    try {
      const current = await this.getAll();
      if (current.length === 0) {
        console.log("BarberServices: Populando catálogo inicial...");
        const defaults = [
          { name: 'Corte Clássico', price: 50, duration: 30, description: 'Corte tradicional com tesoura e máquina.', imageUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400' },
          { name: 'Barba de Respeito', price: 35, duration: 20, description: 'Modelagem de barba com toalha quente.', imageUrl: 'https://images.unsplash.com/photo-1599351474299-48f61248a16c?w=400' },
          { name: 'Combo Premium', price: 75, duration: 50, description: 'Corte + Barba + Lavagem.', imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400' }
        ];
        for (const s of defaults) {
          await addDoc(collection(db, 'services'), s);
        }
      }
    } catch (e) {
      console.warn("BarberServices: Não foi possível popular serviços automaticamente (pode ser falta de permissão admin).", e);
    }
  }
};

export const AppointmentService = {
  async create(appointment: Omit<Appointment, 'id' | 'createdAt'>) {
    console.log("AppointmentService: Tentando criar agendamento...");
    try {
      const dataToSave = {
        ...appointment,
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'appointments'), dataToSave);
      console.log("AppointmentService: Criado!", docRef.id);
      return docRef;
    } catch (e: any) {
      console.error("AppointmentService: Falha fatal:", e);
      handleFirestoreError(e, 'create' as any, 'appointments');
    }
  },

  subscribeUser(userId: string, callback: (apps: Appointment[]) => void) {
    // Simplificado: removido orderBy para evitar erro de índice no Firestore
    const q = query(
      collection(db, 'appointments'),
      where('userId', '==', userId)
    );
    return onSnapshot(q, (snap) => {
      const apps = snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(), 
        date: d.data().date.toDate() 
      } as Appointment));
      // Ordenar na memória para evitar necessidade de índice composto
      apps.sort((a, b) => b.date.getTime() - a.date.getTime());
      callback(apps);
    }, (e) => {
      console.error("AppointmentService: Erro no snapshot:", e);
    });
  },

  async cancel(appointmentId: string) {
    try {
      const docRef = doc(db, 'appointments', appointmentId);
      await updateDoc(docRef, { status: 'cancelled' });
      console.log("AppointmentService: Agendamento cancelado:", appointmentId);
    } catch (e) {
      handleFirestoreError(e, 'update' as any, `appointments/${appointmentId}`);
    }
  }
};

export const QueueService = {
  async join(userId: string, userName: string) {
    try {
      return await addDoc(collection(db, 'queue'), {
        userId,
        userName,
        status: 'waiting',
        joinedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, 'create' as any, 'queue');
    }
  },

  async leave(queueId: string) {
    try {
      const docRef = doc(db, 'queue', queueId);
      await deleteDoc(docRef);
      console.log("QueueService: Usuário saiu da fila:", queueId);
    } catch (e) {
      handleFirestoreError(e, 'delete' as any, `queue/${queueId}`);
    }
  },

  async finish(queueId: string) {
    try {
      const docRef = doc(db, 'queue', queueId);
      await updateDoc(docRef, { status: 'finished' });
      console.log("QueueService: Atendimento finalizado:", queueId);
    } catch (e) {
      handleFirestoreError(e, 'update' as any, `queue/${queueId}`);
    }
  },

  async serve(queueId: string) {
    try {
      const docRef = doc(db, 'queue', queueId);
      await updateDoc(docRef, { status: 'serving' });
      console.log("QueueService: Iniciando atendimento:", queueId);
    } catch (e) {
      handleFirestoreError(e, 'update' as any, `queue/${queueId}`);
    }
  },

  subscribe(callback: (items: QueueItem[]) => void) {
    const q = query(collection(db, 'queue'), where('status', '!=', 'finished'));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as QueueItem));
      // Ordenar manualmente porque 'where status != finished' impede orderBy joinedAt
      items.sort((a, b) => a.joinedAt?.toMillis() - b.joinedAt?.toMillis());
      callback(items);
    }, (e) => handleFirestoreError(e, 'get' as any, 'queue'));
  }
};
