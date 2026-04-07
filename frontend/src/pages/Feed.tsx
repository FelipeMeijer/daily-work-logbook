import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Search } from "lucide-react";
import api from "../api";
import { useAuth } from "../AuthContext";

interface Entry {
  id: string;
  date: string;
  content: string;
  tags: string[];
}

export default function Feed() {
  const { logout, user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = async (q: string, p: number) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), limit: "10" };
      if (q) params.search = q;
      const res = await api.get("/entries", { params });
      setEntries(res.data.entries);
      setTotalPages(res.data.pagination.totalPages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(search, page); }, [search, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load(search, 1);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Work Logbook</h1>
          <p className="text-gray-400 text-sm">Past entries</p>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="text-indigo-400 hover:text-indigo-300 text-sm">Dashboard</a>
          <span className="text-gray-400 text-sm hidden sm:block">{user?.email}</span>
          <button onClick={logout} className="text-gray-400 hover:text-white text-sm">Sign out</button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search entries..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 px-5 py-3 rounded-lg text-sm font-medium transition-colors">
            Search
          </button>
        </form>

        {loading ? (
          <p className="text-gray-500 text-center py-12">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No entries found</p>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div key={entry.id} className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-indigo-400">
                    {format(new Date(entry.date + "T00:00:00"), "EEEE, MMMM d, yyyy")}
                  </h3>
                  {entry.tags.length > 0 && (
                    <div className="flex gap-1">
                      {entry.tags.map((tag) => (
                        <span key={tag} className="bg-gray-800 text-gray-400 text-xs px-2 py-1 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap line-clamp-6">
                  {entry.content || <span className="text-gray-600 italic">No content</span>}
                </p>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg text-sm transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-gray-400 text-sm">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg text-sm transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
