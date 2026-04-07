import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { LogIn, LogOut, Save, Plus, Trash2, Check } from "lucide-react";
import api from "../api";
import { useAuth } from "../AuthContext";

interface CheckInData {
  startTime: string | null;
  endTime: string | null;
}

interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const displayDate = format(new Date(), "EEEE, MMMM d");

  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [checkIn, setCheckIn] = useState<CheckInData>({ startTime: null, endTime: null });
  const [checkLoading, setCheckLoading] = useState(false);

  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [newItem, setNewItem] = useState("");

  const loadAll = useCallback(async () => {
    const [entryRes, checkRes, actionsRes] = await Promise.all([
      api.get(`/entries/${today}`).catch(() => ({ data: { content: "" } })),
      api.get(`/checkin/${today}`).catch(() => ({ data: { startTime: null, endTime: null } })),
      api.get("/action-items").catch(() => ({ data: [] })),
    ]);
    setContent(entryRes.data.content ?? "");
    setCheckIn(checkRes.data);
    setActionItems(actionsRes.data);
  }, [today]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveEntry = async () => {
    setSaving(true);
    try {
      await api.put(`/entries/${today}`, { content });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleCheckIn = async () => {
    setCheckLoading(true);
    try {
      const res = await api.post("/checkin");
      setCheckIn(res.data);
    } finally {
      setCheckLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckLoading(true);
    try {
      const res = await api.post("/checkout");
      setCheckIn(res.data);
    } finally {
      setCheckLoading(false);
    }
  };

  const addActionItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    const res = await api.post("/action-items", { text: newItem.trim() });
    setActionItems((prev) => [...prev, res.data]);
    setNewItem("");
  };

  const toggleItem = async (item: ActionItem) => {
    const res = await api.patch(`/action-items/${item.id}`, { completed: !item.completed });
    setActionItems((prev) => prev.map((i) => (i.id === item.id ? res.data : i)));
  };

  const deleteItem = async (id: string) => {
    await api.delete(`/action-items/${id}`);
    setActionItems((prev) => prev.filter((i) => i.id !== id));
  };

  const formatTime = (iso: string | null) =>
    iso ? format(new Date(iso), "HH:mm") : null;

  const duration = () => {
    if (!checkIn.startTime) return null;
    const end = checkIn.endTime ? new Date(checkIn.endTime) : new Date();
    const mins = Math.floor((end.getTime() - new Date(checkIn.startTime).getTime()) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Work Logbook</h1>
          <p className="text-gray-400 text-sm">{displayDate}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm hidden sm:block">{user?.email}</span>
          <button onClick={logout} className="text-gray-400 hover:text-white text-sm">Sign out</button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Check-in card */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="font-semibold text-gray-200 mb-4">Today</h2>
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={handleCheckIn}
                disabled={checkLoading || !!checkIn.startTime}
                className="flex items-center gap-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <LogIn size={16} /> Check In
              </button>
              <button
                onClick={handleCheckOut}
                disabled={checkLoading || !checkIn.startTime || !!checkIn.endTime}
                className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <LogOut size={16} /> Check Out
              </button>
              <div className="text-sm text-gray-400 space-x-4">
                {checkIn.startTime && <span>In: <span className="text-white">{formatTime(checkIn.startTime)}</span></span>}
                {checkIn.endTime && <span>Out: <span className="text-white">{formatTime(checkIn.endTime)}</span></span>}
                {checkIn.startTime && <span>Duration: <span className="text-indigo-400 font-medium">{duration()}</span></span>}
              </div>
            </div>
          </div>

          {/* Log editor */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-200">Daily Log</h2>
              <button
                onClick={saveEntry}
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Save size={14} />
                {saved ? "Saved!" : saving ? "Saving..." : "Save"}
              </button>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What did you work on today? What decisions were made? Any blockers?"
              rows={14}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono text-sm leading-relaxed"
            />
            <p className="text-gray-600 text-xs mt-2">Supports markdown</p>
          </div>
        </div>

        {/* Right column — Action items */}
        <div className="space-y-6">
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="font-semibold text-gray-200 mb-4">Action Items</h2>

            <form onSubmit={addActionItem} className="flex gap-2 mb-4">
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Add item..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 p-2 rounded-lg transition-colors"
              >
                <Plus size={16} />
              </button>
            </form>

            <div className="space-y-2">
              {actionItems.length === 0 && (
                <p className="text-gray-600 text-sm text-center py-4">No action items yet</p>
              )}
              {actionItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 group"
                >
                  <button
                    onClick={() => toggleItem(item)}
                    className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      item.completed
                        ? "bg-green-600 border-green-600"
                        : "border-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {item.completed && <Check size={12} />}
                  </button>
                  <span className={`flex-1 text-sm ${item.completed ? "line-through text-gray-500" : "text-gray-200"}`}>
                    {item.text}
                  </span>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
