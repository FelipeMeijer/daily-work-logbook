import { create } from 'zustand';
import { api } from '@/src/lib/api';

export interface CheckIn {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string | null; // ISO string
  endTime: string | null;   // ISO string
}

export interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

interface DashboardState {
  checkIn: CheckIn | null;
  actionItems: ActionItem[];
  isLoading: boolean;
  fetchCheckIn: (date: string) => Promise<void>;
  checkIn: () => Promise<void>;
  checkOut: () => Promise<void>;
  fetchActionItems: () => Promise<void>;
  addActionItem: (text: string) => Promise<void>;
  toggleActionItem: (id: string) => Promise<void>;
  deleteActionItem: (id: string) => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  checkIn: null,
  actionItems: [],
  isLoading: false,

  fetchCheckIn: async (date: string) => {
    set({ isLoading: true });
    try {
      const data = await api.get<CheckIn>(`/checkin/${date}`);
      set({ checkIn: data });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('404')) {
        console.error('fetchCheckIn error:', err);
      }
      set({ checkIn: null });
    } finally {
      set({ isLoading: false });
    }
  },

  checkIn: async () => {
    try {
      const data = await api.post<CheckIn>('/checkin');
      set({ checkIn: data });
    } catch (err) {
      console.error('checkIn error:', err);
      throw err;
    }
  },

  checkOut: async () => {
    try {
      const current = get().checkIn;
      if (!current) return;
      const data = await api.post<CheckIn>('/checkout');
      set({ checkIn: data });
    } catch (err) {
      console.error('checkOut error:', err);
      throw err;
    }
  },

  fetchActionItems: async () => {
    try {
      const items = await api.get<ActionItem[]>('/action-items');
      set({ actionItems: items ?? [] });
    } catch (err) {
      console.error('fetchActionItems error:', err);
    }
  },

  addActionItem: async (text: string) => {
    try {
      const item = await api.post<ActionItem>('/action-items', { text });
      set((state) => ({ actionItems: [...state.actionItems, item] }));
    } catch (err) {
      console.error('addActionItem error:', err);
      throw err;
    }
  },

  toggleActionItem: async (id: string) => {
    const current = get().actionItems.find((i) => i.id === id);
    if (!current) return;
    // Optimistically update
    set((state) => ({
      actionItems: state.actionItems.map((i) =>
        i.id === id ? { ...i, completed: !i.completed } : i,
      ),
    }));
    try {
      const updated = await api.patch<ActionItem>(`/action-items/${id}`, {
        completed: !current.completed,
      });
      set((state) => ({
        actionItems: state.actionItems.map((i) => (i.id === id ? updated : i)),
      }));
    } catch (err) {
      // Revert on failure
      set((state) => ({
        actionItems: state.actionItems.map((i) =>
          i.id === id ? { ...i, completed: current.completed } : i,
        ),
      }));
      console.error('toggleActionItem error:', err);
    }
  },

  deleteActionItem: async (id: string) => {
    const prev = get().actionItems;
    set((state) => ({
      actionItems: state.actionItems.filter((i) => i.id !== id),
    }));
    try {
      await api.delete(`/action-items/${id}`);
    } catch (err) {
      set({ actionItems: prev });
      console.error('deleteActionItem error:', err);
    }
  },
}));
