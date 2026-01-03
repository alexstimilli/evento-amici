import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  Plus,
  Share2,
  Home,
  Loader2,
  TrendingUp,
  CheckCircle2,
  Users,
  Info,
  AlertTriangle
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// Dichiarazione per TypeScript per evitare errori rossi
declare const process: { env: any };

// --- Configurazione Chiavi ---
// Usa direttamente process.env che viene gestito da Vite
const JSONBIN_TOKEN = process.env.JSONBIN_TOKEN || "";
const JSONBIN_URL = "https://api.jsonbin.io/v3/b";

// --- Tipi di dati ---
interface User {
  id: string;
  name: string;
  color: string;
}

interface EventData {
  eventName: string;
  users: User[];
  unavailableDates: { [date: string]: string[] }; // data -> lista ID utenti occupati
}

// --- Colori e Costanti ---
const COLORS = ['bg-blue-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-fuchsia-500'];
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function App() {
  const [view, setView] = useState<'home' | 'event'>('home');
  const [eventName, setEventName] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [unavailableDates, setUnavailableDates] = useState<{ [date: string]: string[] }>({});
  const [myId, setMyId] = useState<string | null>(localStorage.getItem('my_id'));
  const [myName, setMyName] = useState(localStorage.getItem('my_name') || '');
  const [binId, setBinId] = useState<string | null>(new URLSearchParams(window.location.search).get('id'));
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [aiTip, setAiTip] = useState('');

  // Carica i dati se c'è un ID nell'URL
  useEffect(() => {
    if (binId) {
      setView('event');
      loadEvent(binId);
    }
  }, [binId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadEvent = async (id: string) => {
    if (!JSONBIN_TOKEN) {
      console.warn("JSONBIN_TOKEN mancante");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${JSONBIN_URL}/${id}`, {
        headers: { 'X-Master-Key': JSONBIN_TOKEN }
      });
      if (!res.ok) throw new Error("Errore fetch");
      const data = await res.json();
      setEventName(data.record.eventName);
      setUsers(data.record.users);
      setUnavailableDates(data.record.unavailableDates || {});
    } catch (e) {
      showToast("Errore nel caricamento dell'evento");
    } finally {
      setLoading(false);
    }
  };

  const saveEvent = async (updatedUsers: User[], updatedDates: any) => {
    if (!binId || !JSONBIN_TOKEN) return;
    try {
      await fetch(`${JSONBIN_URL}/${binId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': JSONBIN_TOKEN
        },
        body: JSON.stringify({ eventName, users: updatedUsers, unavailableDates: updatedDates })
      });
    } catch (e) {
      showToast("Errore nel salvataggio");
    }
  };

  const createEvent = async () => {
    if (!eventName || !myName) return;
    
    if (!JSONBIN_TOKEN) {
      showToast("ERRORE: Configura JSONBIN_TOKEN nel file .env o su Vercel");
      return;
    }

    setLoading(true);
    const newMyId = Math.random().toString(36).substr(2, 9);
    const firstUser = { id: newMyId, name: myName, color: COLORS[0] };
    
    try {
      const res = await fetch(JSONBIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': JSONBIN_TOKEN,
          'X-Bin-Private': 'true'
        },
        body: JSON.stringify({ eventName, users: [firstUser], unavailableDates: {} })
      });
      
      if (!res.ok) throw new Error("Errore creazione");
      
      const data = await res.json();
      const newBinId = data.metadata.id;
      
      setMyId(newMyId);
      localStorage.setItem('my_id', newMyId);
      localStorage.setItem('my_name', myName);
      setBinId(newBinId);
      setUsers([firstUser]);
      
      const url = new URL(window.location.href);
      url.searchParams.set('id', newBinId);
      window.history.pushState({}, '', url.toString());
      setView('event');
    } catch (e) {
      showToast("Impossibile creare l'evento. Controlla il Token.");
    } finally {
      setLoading(false);
    }
  };

  const joinEvent = async () => {
    if (!myName || !binId) return;
    const newId = Math.random().toString(36).substr(2, 9);
    const newUser = { id: newId, name: myName, color: COLORS[users.length % COLORS.length] };
    const newUsers = [...users, newUser];
    
    setMyId(newId);
    localStorage.setItem('my_id', newId);
    localStorage.setItem('my_name', myName);
    setUsers(newUsers);
    await saveEvent(newUsers, unavailableDates);
    showToast(`Benvenuto, ${myName}!`);
  };

  const toggleDate = async (isoDate: string) => {
    if (!myId) return;
    const current = unavailableDates[isoDate] || [];
    const isBusy = current.includes(myId);
    const newList = isBusy ? current.filter(id => id !== myId) : [...current, myId];
    
    const newDates = { ...unavailableDates, [isoDate]: newList };
    if (newList.length === 0) delete newDates[isoDate];
    
    setUnavailableDates(newDates);
    await saveEvent(users, newDates);
  };

  const bestDates = useMemo(() => {
    if (users.length === 0) return [];
    const today = new Date();
    const list = [];
    for (let i = 0; i < 60; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const busyCount = (unavailableDates[iso] || []).length;
      list.push({ iso, available: users.length - busyCount });
    }
    return list.sort((a, b) => b.available - a.available).slice(0, 3);
  }, [users, unavailableDates]);

  const getAiConsiglio = async () => {
    if (!process.env.API_KEY) { 
      setAiTip("Configura la variabile API_KEY per usare l'IA!"); 
      return; 
    }
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Analizza questo evento: "${eventName}". Partecipanti totali: ${users.length}. 
      Le date con più persone sono: ${bestDates.map(d => `${d.iso} (${d.available} presenti)`).join(', ')}.
      Dammi un consiglio breve (max 20 parole) su quale scegliere in modo simpatico in italiano.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      setAiTip(response.text || "Nessun consiglio disponibile.");
    } catch (e) {
      console.error(e);
      setAiTip("L'IA è timida oggi, riprova più tardi!");
    } finally {
      setLoading(false);
    }
  };

  if (view === 'home' && !binId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-200">
          <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3 text-white">
            <CalendarIcon size={32} />
          </div>
          <h1 className="text-3xl font-bold text-center mb-2">Evento Facile</h1>
          <p className="text-center text-slate-500 mb-8 italic">Mettiamoci d'accordo!</p>
          <div className="space-y-4">
            <input value={myName} onChange={e => setMyName(e.target.value)} placeholder="Tuo Nome" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
            <input value={eventName} onChange={e => setEventName(e.target.value)} placeholder="Nome dell'Evento (es. Pizza!)" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
            
            {!JSONBIN_TOKEN && (
               <div className="bg-amber-50 text-amber-600 text-xs p-3 rounded-lg flex gap-2 items-start">
                 <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                 <span><b>Attenzione:</b> JSONBIN_TOKEN non configurato. L'app non potrà salvare i dati.</span>
               </div>
            )}

            <button onClick={createEvent} disabled={loading || !eventName || !myName} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" /> : <Plus size={20} />} Crea Evento
            </button>
          </div>
        </div>
      </div>
    );
  }

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDay = (new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() + 6) % 7;

  return (
    <div className="min-h-screen max-w-4xl mx-auto p-4 lg:p-10 space-y-8">
      <nav className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><CalendarIcon size={20}/></div>
          <h2 className="font-bold text-lg">{eventName}</h2>
        </div>
        <button onClick={() => { navigator.clipboard.writeText(window.location.href); showToast("Link copiato!"); }} className="flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-all">
          <Share2 size={16}/> Condividi
        </button>
      </nav>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 flex justify-between items-center border-b border-slate-100">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-2 hover:bg-white rounded-lg"><ChevronLeft/></button>
              <span className="font-bold text-slate-700">{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-2 hover:bg-white rounded-lg"><ChevronRight/></button>
            </div>
            
            <div className="grid grid-cols-7 text-center p-2 text-[10px] font-bold text-slate-400">
              {DAYS.map(d => <div key={d}>{d}</div>)}
            </div>
            
            <div className="grid grid-cols-7 p-2">
              {Array(firstDay).fill(null).map((_, i) => <div key={`empty-${i}`} className="h-16" />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                const iso = date.toISOString().split('T')[0];
                const busy = unavailableDates[iso] || [];
                const isMeBusy = busy.includes(myId || '');
                const availability = users.length > 0 ? (users.length - busy.length) / users.length : 1;

                return (
                  <div key={day} onClick={() => toggleDate(iso)} className={`h-16 border border-slate-50 relative cursor-pointer flex flex-col items-center justify-center transition-all ${isMeBusy ? 'bg-rose-50' : 'hover:bg-indigo-50/30'}`}>
                    <span className={`text-sm font-bold ${isMeBusy ? 'text-rose-600' : 'text-slate-600'}`}>{day}</span>
                    <div className="absolute bottom-1 w-4/5 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full transition-all ${availability > 0.7 ? 'bg-emerald-400' : availability > 0.4 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${availability * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-slate-400 text-center">Tocca i giorni in cui <b>NON</b> puoi esserci.</p>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-700"><Users size={18}/> Partecipanti ({users.length})</h3>
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${u.color}`} />
                  <span className={`text-sm ${u.id === myId ? 'font-bold text-indigo-600' : 'text-slate-600'}`}>{u.name} {u.id === myId && '(Tu)'}</span>
                </div>
              ))}
              {!myId && (
                <div className="pt-4 space-y-3">
                  <input value={myName} onChange={e => setMyName(e.target.value)} placeholder="Tuo Nome" className="w-full text-sm p-2 border rounded-lg outline-none" />
                  <button onClick={joinEvent} className="w-full bg-emerald-500 text-white py-2 rounded-lg text-sm font-bold">Unisciti all'Evento</button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-indigo-600 p-6 rounded-3xl shadow-lg text-white space-y-4">
            <h3 className="font-bold flex items-center gap-2"><Sparkles size={18}/> Suggerimenti</h3>
            <div className="space-y-3">
              {bestDates.map((d, i) => (
                <div key={d.iso} className="bg-white/10 p-3 rounded-xl border border-white/10 flex justify-between items-center">
                  <span className="text-sm font-medium">{new Date(d.iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
                  <span className="text-[10px] bg-emerald-400 text-emerald-900 px-2 py-1 rounded-full font-bold">{d.available} Presenti</span>
                </div>
              ))}
            </div>
            {aiTip ? (
              <p className="text-xs italic bg-white/5 p-3 rounded-xl border border-white/5">{aiTip}</p>
            ) : (
              <button onClick={getAiConsiglio} disabled={loading || users.length === 0} className="w-full bg-white text-indigo-600 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={14}/> : <Sparkles size={14}/>} Chiedi Consiglio all'IA
              </button>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-bounce z-50">
          <CheckCircle2 className="text-emerald-400" size={18}/> {toast}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);