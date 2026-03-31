import { create } from 'zustand';
import { api } from '@/src/lib/api';

export interface LogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface FeedParams {
  search?: string;
  tag?: string;
  page?: number;
}

interface LogState {
  entries: Record<string, LogEntry>;
  feed: LogEntry[];
  isLoading: boolean;
  fetchEntry: (date: string) => Promise<void>;
  saveEntry: (date: string, content: string, tags: string[]) => Promise<void>;
  fetchFeed: (params?: FeedParams) => Promise<void>;
}

export const useLogStore = create<LogState>((set, get) => ({
  entries: {},
  feed: [],
  isLoading: false,

  fetchEntry: async (date: string) => {
    set({ isLoading: true });
    try {
      const entry = await api.get<LogEntry>(`/logs/${date}`);
      set((state) => ({
        entries: { ...state.entries, [date]: entry },
      }));
    } catch (err: unknown) {
      // If 404, we just have no entry for that date — that's fine
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('404')) {
        console.error('fetchEntry error:', err);
      }
    } finally {
      set({ isLoading: false });
    }
  },

  saveEntry: async (date: string, content: string, tags: string[]) => {
    try {
      const existing = get().entries[date];
      let saved: LogEntry;
      if (existing?.id) {
        saved = await api.put<LogEntry>(`/logs/${date}`, { content, tags });
      } else {
        saved = await api.post<LogEntry>('/logs', { date, content, tags });
      }
      set((state) => ({
        entries: { ...state.entries, [date]: saved },
      }));
    } catch (err) {
      console.error('saveEntry error:', err);
      throw err;
    }
  },

  fetchFeed: async (params: FeedParams = {}) => {
    set({ isLoading: true });
    try {
      const queryParts: string[] = [];
      if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
      if (params.tag) queryParts.push(`tag=${encodeURIComponent(params.tag)}`);
      if (params.page !== undefined) queryParts.push(`page=${params.page}`);
      const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

      const result = await api.get<{ entries: LogEntry[]; total: number }>(`/logs${qs}`);
      const entries = result?.entries ?? (result as unknown as LogEntry[]);

      if (params.page && params.page > 1) {
        set((state) => ({ feed: [...state.feed, ...entries] }));
      } else {
        set({ feed: entries });
      }
    } catch (err) {
      console.error('fetchFeed error:', err);
    } finally {
      set({ isLoading: false });
    }
  },
}));
