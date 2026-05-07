/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Scissors, 
  Calendar, 
  Clock, 
  User, 
  LogOut, 
  ChevronRight, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  Menu,
  X,
  Sparkles,
  Download,
  FileText,
  BookOpen,
  ShieldCheck
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { auth, googleProvider, db } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { BarberServices, AppointmentService, QueueService, UserService } from './lib/services';
import type { BarberService, Appointment, QueueItem, UserProfile } from './lib/firebase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from "@google/genai";

// Configuração segura do Gemini (Acessado via variável de ambiente do AI Studio)
const getGeminiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY") {
    console.warn("Atenção: GEMINI_API_KEY não configurada corretamente.");
    return "";
  }
  return key;
};

const ai = new GoogleGenAI({ apiKey: getGeminiKey() });

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Componente Layout
const PageContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-[#f5f2ed] text-[#1a1a1a] font-sans selection:bg-[#1a1a1a] selection:text-white">
    {children}
  </div>
);

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'home' | 'schedule' | 'queue' | 'catalog' | 'ai' | 'manual'>('home');
  const [services, setServices] = useState<BarberService[]>([]);
  const [userAppointments, setUserAppointments] = useState<Appointment[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    console.log("App: Iniciando listener de autenticação...");
    
    // Timeout de segurança: Se o Firebase não responder em 3 segundos, libera a tela
    const safetyTimeout = setTimeout(() => {
      console.warn("App: Timeout de segurança atingido. Forçando fim do carregamento.");
      setLoading(false);
    }, 3000);

    const unsub = onAuthStateChanged(auth, async (u) => {
      console.log("App: Estado de autenticação alterado:", u ? "Logado" : "Deslogado");
      clearTimeout(safetyTimeout);
      setUser(u);
      setLoading(false);
      
      if (u) {
        try {
          console.log("App: Garantindo perfil do usuário...");
          const p = await UserService.ensureProfile(u);
          console.log("App: Perfil carregado:", p?.email, "Role:", p?.role);
          setProfile(p);
          
          console.log("App: Inicializando dados do usuário...");
          await BarberServices.seed();
          const s = await BarberServices.getAll();
          setServices(s);
          
          AppointmentService.subscribeUser(u.uid, setUserAppointments);
          QueueService.subscribe(setQueue);
        } catch (error) {
          console.error("App: Erro ao carregar dados pós-login:", error);
        }
      }
    }, (error) => {
      console.error("App: Erro no listener de autenticação:", error);
      clearTimeout(safetyTimeout);
      setLoading(false);
    });

    return () => {
      unsub();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const login = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f5f2ed]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        >
          <Scissors className="w-8 h-8 text-[#1a1a1a]" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <PageContainer>
        <section className="h-screen flex flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-xl"
          >
            <Scissors className="w-16 h-16 mx-auto mb-8 text-[#1a1a1a]" />
            <h1 className="text-6xl font-serif font-black tracking-tighter mb-4 uppercase">
              Barber<span className="italic font-light">Flow</span>
            </h1>
            <p className="text-xl opacity-70 mb-12 font-medium">
              Experiência de barbearia premium com agendamento inteligente.
            </p>
            <button
              onClick={login}
              className="bg-[#1a1a1a] text-white px-8 py-4 rounded-full font-bold flex items-center gap-3 hover:scale-105 transition-transform mx-auto shadow-2xl"
            >
              Entrar com Google
              <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-[#1a1a1a]/10 bg-[#f5f2ed]/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-2xl font-serif font-bold tracking-tighter cursor-pointer" onClick={() => setView('home')}>
            B<span className="italic font-light">F</span>
          </div>
          
          <div className="hidden md:flex gap-8 items-center font-bold text-sm uppercase tracking-widest">
            <button onClick={() => setView('home')} className={cn("hover:opacity-100 transition-opacity", view === 'home' ? "opacity-100 border-b-2 border-[#1a1a1a]" : "opacity-40")}>Início</button>
            <button onClick={() => setView('catalog')} className={cn("hover:opacity-100 transition-opacity", view === 'catalog' ? "opacity-100 border-b-2 border-[#1a1a1a]" : "opacity-40")}>Catálogo</button>
            <button onClick={() => setView('schedule')} className={cn("hover:opacity-100 transition-opacity", view === 'schedule' ? "opacity-100 border-b-2 border-[#1a1a1a]" : "opacity-40")}>Agendar</button>
            <button onClick={() => setView('queue')} className={cn("hover:opacity-100 transition-opacity", view === 'queue' ? "opacity-100 border-b-2 border-[#1a1a1a]" : "opacity-40")}>Fila Vivo</button>
            <button onClick={() => setView('ai')} className={cn("hover:opacity-100 transition-opacity", view === 'ai' ? "opacity-100 border-b-2 border-[#1a1a1a]" : "opacity-40")}>IA Consultor</button>
            <button onClick={() => setView('manual')} className={cn("hover:opacity-100 transition-opacity flex items-center gap-2", view === 'manual' ? "opacity-100 border-b-2 border-[#1a1a1a]" : "opacity-40")}>
              Manual <FileText className="w-4 h-4" />
            </button>
            <button onClick={logout} className="opacity-40 hover:opacity-100 transition-opacity"><LogOut className="w-4 h-4" /></button>
          </div>

          <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed inset-0 z-40 bg-[#f5f2ed] pt-24 px-8 flex flex-col gap-6"
          >
            {['home', 'catalog', 'schedule', 'queue'].map((v) => (
              <button 
                key={v}
                onClick={() => { setView(v as any); setIsMenuOpen(false); }}
                className="text-4xl font-serif font-bold capitalize text-left"
              >
                {v === 'home' ? 'Início' : v === 'catalog' ? 'Catálogo' : v === 'schedule' ? 'Agendar' : 'Fila Vivo'}
              </button>
            ))}
            <button onClick={logout} className="text-xl font-bold uppercase mt-12 flex items-center gap-2">Sair <LogOut /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="pt-28 pb-20 px-6 max-w-7xl mx-auto">
        {view === 'home' && <Home user={user} profile={profile} appointments={userAppointments} queue={queue} setView={setView} />}
        {view === 'catalog' && <Catalog services={services} setView={setView} />}
        {view === 'schedule' && <Schedule services={services} user={user} setView={setView} />}
        {view === 'queue' && <LiveQueue queue={queue} user={user} isAdmin={profile?.role === 'admin'} />}
        {view === 'ai' && <AIRecommendations />}
        {view === 'manual' && <Manual />}
      </main>
    </PageContainer>
  );
}

const AIRecommendations = () => {
  const [prompt, setPrompt] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [loading, setLoading] = useState(false);

  const getRec = async () => {
    if (!prompt) return;
    setLoading(true);
    try {
      const fullPrompt = `Você é um barbeiro especialista. Com base nessa descrição do cliente, sugira um corte do nosso catálogo (Clássico, Barba de Respeito, Combo Premium) e dê uma dica de estilo Curta e Impactante: ${prompt}`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: fullPrompt }] }]
      });
      
      setRecommendation(response.text || "Não foi possível gerar uma recomendação no momento.");
    } catch (e) {
      console.error("Gemini Error:", e);
      setRecommendation("Erro ao consultar o especialista digital. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-4xl font-serif font-black mb-4 uppercase">Consultor de Estilo</h2>
      <p className="opacity-60 mb-8 font-serif italic text-xl">Diga ao nosso barbeiro IA como você se sente hoje e ele sugerirá o visual perfeito.</p>
      
      <div className="bg-white border border-[#1a1a1a]/10 p-8 rounded-[40px] shadow-sm">
        <textarea 
          className="w-full h-32 bg-[#f5f2ed] p-6 rounded-3xl outline-none focus:ring-2 ring-[#1a1a1a]/20 mb-6 font-medium"
          placeholder="Ex: Quero algo moderno, mas fácil de manter no dia a dia..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button 
          onClick={getRec}
          disabled={loading || !prompt}
          className="w-full bg-[#1a1a1a] text-white py-4 rounded-full font-bold disabled:opacity-20 flex items-center justify-center gap-2"
        >
          {loading ? 'Consultando Especialista...' : 'Sugerir Estilo'}
        </button>

        {recommendation && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12 p-8 bg-[#1a1a1a] text-white rounded-3xl"
          >
            <p className="text-xs uppercase tracking-widest opacity-50 mb-4">Recomendação da Barbearia</p>
            <p className="text-xl font-serif leading-relaxed line-break-anywhere whitespace-pre-wrap">{recommendation}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

// --- Sub-componentes ---

const Home = ({ user, profile, appointments, queue, setView }: any) => {
  const nextApp = appointments.find((a: any) => a.status === 'pending') || null;
  const userInQueue = queue.find((q: any) => q.userId === user.uid);
  const queuePos = queue.findIndex((q: any) => q.userId === user.uid) + 1;

  return (
    <div className="grid lg:grid-cols-2 gap-12">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h2 className="text-sm font-bold uppercase tracking-[0.3em] opacity-40 mb-2">Seja bem-vindo</h2>
        <h3 className="text-5xl font-serif font-black mb-8">Olá, <span className="italic">{user.displayName?.split(' ')[0]}</span></h3>
        
        <div className="grid gap-6">
          {user.email === 'gibasuporte@gmail.com' && profile?.role !== 'admin' && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-3xl flex flex-col items-center gap-2">
              <p className="text-xs font-bold text-yellow-800">Você deve ser Administrador. Clique abaixo para ativar:</p>
              <button 
                onClick={async () => {
                  await UserService.ensureProfile(user);
                  window.location.reload();
                }}
                className="bg-yellow-600 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase"
              >
                Ativar Modo Barbeiro
              </button>
            </div>
          )}
          <NextAppointmentCard appointment={nextApp} setView={setView} />
          
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#333] text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden ring-1 ring-white/10">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-400">Oferta de Lançamento</p>
              </div>
              <h4 className="text-2xl font-serif italic mb-2">Acesso Total & Suporte</h4>
              <p className="text-sm opacity-70 mb-6 leading-relaxed">Contribua com R$ 10,00 para apoiar o desenvolvimento e garanta todas as atualizações premium futuras.</p>
              <div className="flex flex-wrap items-center gap-4">
                <a 
                  href="https://mpago.la/1brXcKy" 
                  target="_blank" 
                  referrerPolicy="no-referrer"
                  className="bg-white text-[#1a1a1a] px-8 py-3 rounded-full font-bold text-sm inline-block hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  Pagar R$ 10,00 (Mercado Pago)
                </a>
                <span className="text-[10px] opacity-40 uppercase font-black">Pagamento Seguro</span>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 opacity-10">
               <Scissors className="w-32 h-32 rotate-12" />
            </div>
          </div>

          <div className="bg-white border border-[#1a1a1a]/10 p-8 rounded-3xl">
            <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-4">Status da Fila</p>
            {userInQueue ? (
              <div>
                <p className="text-4xl font-serif font-bold mb-2">#0{queuePos}</p>
                <p className="opacity-60">Sua posição atual na fila de espera.</p>
              </div>
            ) : (
              <div>
                <p className="text-xl font-serif opacity-60 mb-6">Você não está na fila no momento.</p>
                <button 
                  onClick={() => QueueService.join(user.uid, user.displayName)}
                  className="border border-[#1a1a1a] py-3 px-6 rounded-full font-bold text-sm hover:bg-[#1a1a1a] hover:text-white transition-all"
                >
                  Entrar na Fila Agora
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="hidden lg:block">
        <img 
          src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800" 
          alt="Barber" 
          className="rounded-[40px] shadow-2xl h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
        />
      </motion.div>
    </div>
  );
};

const NextAppointmentCard = ({ appointment, setView }: any) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    if (!appointment) return;
    setIsCancelling(true);
    console.log("AppointmentCard: Iniciando cancelamento...", appointment.id);
    try {
      await AppointmentService.cancel(appointment.id);
      console.log("AppointmentCard: Cancelado com sucesso.");
    } catch (err) {
      console.error("AppointmentCard: Erro ao cancelar:", err);
    } finally {
      setIsCancelling(false);
      setIsConfirming(false);
    }
  };

  return (
    <div className="bg-[#1a1a1a] text-white p-8 rounded-3xl shadow-xl flex flex-col justify-between min-h-[240px]">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-4">Seu Próximo Passo</p>
        <AnimatePresence mode="wait">
          {appointment ? (
            <motion.div 
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-between items-start"
            >
              <div>
                <h4 className="text-2xl font-serif mb-1 italic">{appointment.serviceName}</h4>
                <p className="flex items-center gap-2 opacity-80 text-sm"><Calendar className="w-4 h-4" /> {format(appointment.date, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
                <p className="flex items-center gap-2 opacity-80 text-sm mt-1"><Clock className="w-4 h-4" /> {format(appointment.date, 'HH:mm')}</p>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                {isConfirming ? (
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={handleCancel}
                      disabled={isCancelling}
                      className="text-[10px] bg-red-600 text-white px-3 py-2 rounded-lg font-black uppercase hover:bg-red-700 transition-colors"
                    >
                      {isCancelling ? 'Processando...' : 'Confirmar Cancelar'}
                    </button>
                    <button 
                      onClick={() => setIsConfirming(false)}
                      disabled={isCancelling}
                      className="text-[10px] bg-white/10 text-white px-3 py-2 rounded-lg font-bold uppercase hover:bg-white/20 transition-colors"
                    >
                      Voltar
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsConfirming(true)}
                    className="text-[10px] bg-red-500/20 text-red-400 px-3 py-2 rounded-lg hover:bg-red-500/40 transition-colors uppercase font-bold"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.p 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xl font-serif italic text-white/40"
            >
              Nenhum agendamento pendente.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <button 
        onClick={() => setView('schedule')}
        className="mt-8 bg-white text-[#1a1a1a] py-3 rounded-full font-bold text-sm w-fit px-8 hover:bg-opacity-90 transition-all font-serif"
      >
        Agendar Novo
      </button>
    </div>
  );
};

const Catalog = ({ services, setView }: any) => (
  <div>
    <h2 className="text-center text-4xl font-serif font-black mb-16 uppercase tracking-tighter">Nosso Catálogo</h2>
    <div className="grid md:grid-cols-3 gap-8">
      {services.map((s: BarberService) => (
        <motion.div 
          key={s.id}
          whileHover={{ y: -10 }}
          className="group cursor-pointer"
          onClick={() => setView('schedule')}
        >
          <div className="aspect-[3/4] overflow-hidden rounded-3xl mb-4">
            <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 scale-110 group-hover:scale-100" />
          </div>
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-serif text-xl font-bold uppercase">{s.name}</h4>
              <p className="text-sm opacity-50 tracking-tighter">{s.description}</p>
            </div>
            <p className="font-bold text-lg">R$ {s.price}</p>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

const Schedule = ({ services, user, setView }: any) => {
  const [selectedService, setSelectedService] = useState<BarberService | null>(null);
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSchedule = async () => {
    if (!selectedService || !date || !time) {
      setError("Por favor, selecione um serviço, data e horário.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    console.log("Schedule: Iniciando processo de agendamento...", { selectedService, date, time });

    try {
      // Correção importante: Construir a data de forma robusta
      // Usar a data local para evitar problemas de fuso horário na conversão
      const [year, month, day] = date.split('-').map(Number);
      const [hours, minutes] = time.split(':').map(Number);
      const dateTime = new Date(year, month - 1, day, hours, minutes);

      if (isNaN(dateTime.getTime())) {
        throw new Error("A data ou hora informada é inválida.");
      }

      console.log("Schedule: Data processada:", dateTime.toLocaleString());

      const result = await AppointmentService.create({
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || "Cliente",
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        date: dateTime,
        status: 'pending'
      });

      if (result) {
        console.log("Schedule: Sucesso absoluto!", result.id);
        setIsSuccess(true);
        setTimeout(() => setView('home'), 2500);
      } else {
        throw new Error("O servidor não retornou uma confirmação de salvamento.");
      }
    } catch (e: any) {
      console.error("Schedule: Falha crítica capturada:", e);
      let userMsg = "Erro ao processar sua reserva.";
      
      if (e.message?.includes("insufficient permissions")) {
        userMsg = "Erro de permissão no banco de dados. Tente sair e entrar novamente.";
      } else if (e.message) {
        userMsg = `Erro: ${e.message}`;
      }
      
      setError(userMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 10 }}
        >
          <CheckCircle2 className="w-20 h-20 text-green-600 mb-4" />
        </motion.div>
        <h2 className="text-3xl font-serif font-bold italic">Agendamento Realizado!</h2>
        <p className="opacity-60">Prepare seu visual, nos vemos em breve.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto border border-[#1a1a1a]/5 bg-white p-12 rounded-[40px] shadow-sm">
      <h2 className="text-3xl font-serif font-black mb-12 text-center uppercase tracking-tighter italic underline underline-offset-8 decoration-1">Reservar Horário</h2>
      
      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-10">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest opacity-40 mb-4 block">1. Escolha o Estilo</label>
          {services.length === 0 ? (
            <div className="p-4 bg-orange-50 border border-orange-200 text-orange-700 rounded-xl text-sm italic">
              Carregando serviços ou catálogo vazio...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {services.map((s: BarberService) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedService(s); setError(null); }}
                  className={cn(
                    "p-4 rounded-2xl text-left border transition-all text-sm font-medium",
                    selectedService?.id === s.id ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "bg-transparent border-[#1a1a1a]/10 hover:border-[#1a1a1a]/30"
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest opacity-40 mb-4 block">2. Data</label>
            <input 
              type="date" 
              className="w-full bg-[#f5f2ed] p-4 rounded-2xl outline-none focus:ring-2 ring-[#1a1a1a]/20" 
              onChange={(e) => setDate(e.target.value)}
              value={date}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest opacity-40 mb-4 block">3. Hora</label>
            <input 
              type="time" 
              className="w-full bg-[#f5f2ed] p-4 rounded-2xl outline-none focus:ring-2 ring-[#1a1a1a]/20" 
              onChange={(e) => setTime(e.target.value)}
              value={time}
            />
          </div>
        </div>

        <button 
          onClick={handleSchedule}
          className={cn(
            "w-full py-5 rounded-full font-bold text-lg flex items-center justify-center gap-2 transition-all",
            isSubmitting 
              ? "bg-gray-400 cursor-wait" 
              : (!selectedService || !date || !time)
                ? "bg-[#1a1a1a]/20 text-[#1a1a1a]/40"
                : "bg-[#1a1a1a] text-white hover:scale-[1.02] active:scale-[0.98]"
          )}
        >
          {isSubmitting ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Scissors className="w-5 h-5" />
            </motion.div>
          ) : (
            <>Confirmar Reserva <ChevronRight className="w-5 h-5" /></>
          )}
        </button>
      </div>
    </div>
  );
};

const LiveQueue = ({ queue, user, isAdmin }: any) => {
  const userInQueue = queue.find((q: any) => q.userId === user.uid);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-4xl font-serif font-black uppercase tracking-tighter">Acompanhe a Fila</h2>
          <p className="opacity-60 flex items-center gap-2 mt-2 italic font-serif">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> Ao vivo agora {isAdmin && <span className="text-[10px] bg-[#1a1a1a] text-white px-2 py-0.5 rounded-full uppercase ml-2">Modo Admin</span>}
          </p>
        </div>
        {!userInQueue && !isAdmin && (
          <button 
            onClick={() => QueueService.join(user.uid, user.displayName)}
            className="bg-[#1a1a1a] text-white px-6 py-3 rounded-full font-bold text-xs uppercase tracking-widest"
          >
            Entrar na Fila
          </button>
        )}
      </div>

      <div className="space-y-4">
        {queue.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-[#1a1a1a]/5 rounded-[40px]">
            <p className="opacity-40 italic font-serif text-xl">A fila está vazia...</p>
          </div>
        ) : (
          queue.map((q: any, i: number) => (
            <QueueItemRow key={q.id} q={q} user={user} index={i} isAdmin={isAdmin} />
          ))
        )}
      </div>
    </div>
  );
};

const QueueItemRow = ({ q, user, index, isAdmin }: any) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleAction = async (action: 'leave' | 'serve' | 'finish') => {
    setIsLeaving(true);
    try {
      if (action === 'leave') await QueueService.leave(q.id);
      if (action === 'serve') await QueueService.serve(q.id);
      if (action === 'finish') await QueueService.finish(q.id);
    } catch (err) {
      console.error(`QueueItem: Erro na ação ${action}:`, err);
    } finally {
      setIsLeaving(false);
      setIsConfirming(false);
    }
  };

  return (
    <motion.div 
      layout
      className={cn(
        "p-6 rounded-3xl border flex justify-between items-center transition-all",
        q.userId === user.uid ? "bg-white border-[#1a1a1a] shadow-xl scale-[1.03] z-10" : "bg-white/40 border-[#1a1a1a]/5"
      )}
    >
      <div className="flex items-center gap-6">
        <span className="text-4xl font-serif font-bold italic opacity-30">0{index + 1}</span>
        <div>
          <h4 className="font-bold text-lg">{q.userName} {q.userId === user.uid && <span className="text-[10px] bg-[#1a1a1a] text-white px-2 py-0.5 rounded-full ml-2 uppercase">Você</span>}</h4>
          <p className="text-xs uppercase tracking-widest opacity-40">
            {q.status === 'serving' ? 'Sendo Atendido' : `Entrou às ${format(q.joinedAt?.toDate?.() || new Date(), 'HH:mm')}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isAdmin ? (
          <div className="flex gap-2">
            {q.status === 'waiting' ? (
              <button 
                onClick={() => handleAction('serve')}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 transition-all text-[10px] font-black uppercase shadow-lg shadow-green-600/20"
                title="Começar Atendimento"
              >
                Atender <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                onClick={() => handleAction('finish')}
                className="flex items-center gap-2 bg-[#1a1a1a] text-white px-4 py-2 rounded-full hover:scale-105 transition-all text-[10px] font-black uppercase shadow-xl"
                title="Finalizar atendimento"
              >
                Finalizar <Scissors className="w-4 h-4 animate-pulse" strokeWidth={3} />
              </button>
            )}
            <button 
              onClick={() => handleAction('leave')}
              className="p-2 border border-red-500/20 text-red-500 rounded-full hover:bg-red-50 transition-colors"
              title="Remover"
            >
              <X className="w-4 h-4" strokeWidth={3} />
            </button>
          </div>
        ) : (
          <>
            {q.userId === user.uid && q.status === 'waiting' && (
              <div className="flex items-center gap-2">
                <AnimatePresence mode="wait">
                  {isConfirming ? (
                    <motion.div 
                      key="confirm" 
                      initial={{ opacity: 0, scale: 0.95 }} 
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex gap-2"
                    >
                      <button 
                        disabled={isLeaving}
                        onClick={() => handleAction('leave')}
                        className="text-[10px] uppercase font-black bg-red-600 text-white px-4 py-2 rounded-full hover:bg-red-700 transition-colors"
                      >
                        {isLeaving ? 'Saindo...' : 'Confirmar'}
                      </button>
                      <button 
                        disabled={isLeaving}
                        onClick={() => setIsConfirming(false)}
                        className="text-[10px] uppercase font-bold bg-gray-200 text-gray-600 px-4 py-2 rounded-full hover:bg-gray-300"
                      >
                        Não
                      </button>
                    </motion.div>
                  ) : (
                    <motion.button 
                      key="initial"
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      onClick={() => setIsConfirming(true)}
                      className="text-[10px] uppercase font-bold bg-[#1a1a1a]/5 text-[#1a1a1a] px-4 py-2 rounded-full hover:bg-red-500 hover:text-white transition-all underline decoration-dotted"
                    >
                      Sair da Fila
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            )}
            {q.status === 'serving' && (
              <div className="bg-[#1a1a1a] text-white p-2 rounded-full">
                <Scissors className="w-4 h-4 animate-pulse" strokeWidth={2.5} />
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};

const Manual = () => {
  const generatePDF = () => {
    const doc = new jsPDF();
    const margin = 20;
    let y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Manual do Aplicativo - Barbearia Moderna", margin, y);
    y += 15;

    doc.setFontSize(14);
    doc.text("1. Para o Proprietário (Admin)", margin, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const ownerText = [
      "- Primeiro Acesso: O primeiro usuário a logar torna-se administrador automaticamente.",
      "- Painel de Controle: Na aba 'Fila Vivo', o admin vê quem está esperando e pode finalizar atendimentos clicando no ícone da tesoura.",
      "- Gestão de Catálogo: Admin pode popular o catálogo inicial ou gerenciar serviços no banco de dados.",
      "- Monitoramento: Visualize todos os agendamentos futuros na tela inicial."
    ];
    ownerText.forEach(line => {
      doc.text(line, margin + 5, y);
      y += 7;
    });

    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("2. Para o Cliente", margin, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const clientText = [
      "- Agendamento: Escolha o estilo, data e hora na aba 'Agendar'.",
      "- Fila Vivo: Se estiver na barbearia, entre na fila digital para acompanhar sua posição em tempo real.",
      "- Gestão: Cancele agendamentos ou saia da fila a qualquer momento pelo seu painel.",
      "- IA Consultor: Use nossa inteligência artificial para receber dicas de estilos que combinam com seu perfil."
    ];
    clientText.forEach(line => {
      doc.text(line, margin + 5, y);
      y += 7;
    });

    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("3. Fluxo de Uso Diário", margin, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.text("O cliente agenda pelo app. O dono recebe a notificação no painel. No dia, o cliente pode entrar na 'Fila Vivo' ao chegar, garantindo transparência no atendimento.", margin + 5, y, { maxWidth: 170 });

    doc.save("manual_barbearia.pdf");
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="flex justify-between items-center mb-12">
        <h2 className="text-4xl font-serif font-black uppercase italic tracking-tighter">Guia de Uso</h2>
        <button 
          onClick={generatePDF}
          className="bg-[#1a1a1a] text-white px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 hover:scale-105 transition-transform"
        >
          <Download className="w-4 h-4" /> Baixar Manual PDF
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-12">
        <div className="space-y-8">
          <section className="bg-white p-8 rounded-[40px] border border-[#1a1a1a]/5 shadow-sm">
            <h3 className="text-xl font-serif font-bold italic mb-4 flex items-center gap-2">
              <User className="w-5 h-5" /> Para o Proprietário
            </h3>
            <ul className="space-y-4 text-sm opacity-70 leading-relaxed">
              <li className="flex gap-3">
                <span className="font-black">01.</span>
                Acesso Admin: O sistema identifica automaticamente o dono no primeiro login.
              </li>
              <li className="flex gap-3">
                <span className="font-black">02.</span>
                Gestão da Fila: Monitore a Fila Vivo e clique na tesoura para marcar como "concluído".
              </li>
              <li className="flex gap-3">
                <span className="font-black text-yellow-500">PRO</span>
                Segurança Total: As chaves de API são gerenciadas em ambiente seguro (Server-side/Environment), protegendo sua conta contra acessos indevidos.
              </li>
            </ul>
          </section>

          <section className="bg-white p-8 rounded-[40px] border border-[#1a1a1a]/5 shadow-sm">
            <h3 className="text-xl font-serif font-bold italic mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> Proteção de Dados
            </h3>
            <p className="text-sm opacity-70 leading-relaxed mb-4">
              Este aplicativo utiliza práticas modernas de segurança de chaves:
            </p>
            <ul className="space-y-2 text-[11px] opacity-60">
              <li>• Chaves sensíveis (Gemini/AI) ficam isoladas no ambiente seguro do servidor.</li>
              <li>• Firebase Security Rules configuradas para impedir acessos não autorizados.</li>
              <li>• Nenhuma senha é armazenada localmente; usamos Google Auth seguro.</li>
            </ul>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-[#1a1a1a] text-white p-8 rounded-[40px] shadow-xl">
            <h3 className="text-xl font-serif font-bold italic mb-4 flex items-center gap-2 text-white/90">
              <Calendar className="w-5 h-5" /> Para o Cliente
            </h3>
            <ul className="space-y-4 text-sm opacity-80 leading-relaxed">
              <li className="flex gap-3">
                <span className="font-black">01.</span>
                Reservas: Marque seu horário com apenas 3 cliques, escolhendo serviço e horário.
              </li>
              <li className="flex gap-3">
                <span className="font-black">02.</span>
                Fila Online: Chegou na loja? Entre na fila digital e saiba exatamente sua posição.
              </li>
              <li className="flex gap-3">
                <span className="font-black">03.</span>
                Liberdade: Cancele ou altere sua posição na fila diretamente pelo seu celular.
              </li>
            </ul>
          </section>

          <div className="p-8 border-2 border-dashed border-[#1a1a1a]/10 rounded-[40px] flex items-center gap-6">
            <BookOpen className="w-12 h-12 opacity-20" />
            <p className="text-sm italic opacity-50">
              "Este sistema foi projetado para eliminar o papel e a incerteza da espera, modernizando a relação entre barbeiro e cliente."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
