import { useState, useEffect, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  parseISO,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import api from "../api";

interface OutlookEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  bodyPreview: string;
}

interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
  dueDate: string | null;
}

interface NewEventForm {
  subject: string;
  date: string;
  startTime: string;
  endTime: string;
}

const EMPTY_FORM: NewEventForm = { subject: "", date: "", startTime: "09:00", endTime: "10:00" };

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<OutlookEvent[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [form, setForm] = useState<NewEventForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const loadData = useCallback(async () => {
    const startStr = format(monthStart, "yyyy-MM-dd");
    const endStr = format(monthEnd, "yyyy-MM-dd");

    // Load action items (always available)
    api.get<ActionItem[]>("/action-items")
      .then((r) => setActionItems(r.data))
      .catch(() => {});

    // Try loading Outlook events
    api.get<OutlookEvent[]>(`/calendar/events?start=${startStr}&end=${endStr}`)
      .then((r) => { setEvents(r.data); setCalendarConnected(true); })
      .catch((err) => {
        if (err?.response?.status === 400) setCalendarConnected(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad to start on Monday
  const startPad = (monthStart.getDay() + 6) % 7; // 0=Mon
  const paddedDays: (Date | null)[] = [...Array(startPad).fill(null), ...days];

  function eventsForDay(day: Date) {
    return events.filter((e) => isSameDay(parseISO(e.start.dateTime), day));
  }

  function todosForDay(day: Date) {
    return actionItems.filter(
      (a) => a.dueDate && isSameDay(parseISO(a.dueDate), day)
    );
  }

  function dayItems(day: Date) {
    return { events: eventsForDay(day), todos: todosForDay(day) };
  }

  const openNewEvent = (day: Date) => {
    setForm({ ...EMPTY_FORM, date: format(day, "yyyy-MM-dd") });
    setShowNewEvent(true);
  };

  const saveEvent = async () => {
    if (!form.subject || !form.date) return;
    setSaving(true);
    try {
      const start = `${form.date}T${form.startTime}:00`;
      const end = `${form.date}T${form.endTime}:00`;
      const ev = await api.post<OutlookEvent>("/calendar/events", {
        subject: form.subject,
        start,
        end,
      });
      setEvents((prev) => [...prev, ev.data]);
      setShowNewEvent(false);
      setForm(EMPTY_FORM);
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (id: string) => {
    await api.delete(`/calendar/events/${id}`);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const selectedItems = selectedDay ? dayItems(selectedDay) : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Calendar</h1>
        <div className="flex items-center gap-3">
          {calendarConnected === false && (
            <a
              href="/onedrive/auth"
              className="text-xs bg-blue-700 hover:bg-blue-600 px-3 py-1.5 rounded-lg"
            >
              Connect Outlook
            </a>
          )}
          <a href="/" className="text-gray-400 hover:text-white text-sm">Dashboard</a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-gray-800 rounded-lg">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-gray-800 rounded-lg">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="text-center text-xs text-gray-500 py-2">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-800 rounded-xl overflow-hidden border border-gray-800">
          {paddedDays.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} className="bg-gray-950 min-h-[80px]" />;
            const { events: dayEvents, todos: dayTodos } = dayItems(day);
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const inMonth = isSameMonth(day, currentMonth);
            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDay(isSameDay(day, selectedDay!) ? null : day)}
                className={`bg-gray-950 min-h-[80px] p-2 cursor-pointer hover:bg-gray-900 transition-colors ${
                  isSelected ? "ring-2 ring-inset ring-indigo-500" : ""
                }`}
              >
                <div className={`text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday(day) ? "bg-indigo-600 text-white" : inMonth ? "text-gray-200" : "text-gray-600"
                }`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 2).map((e) => (
                    <div key={e.id} className="text-xs bg-blue-900 text-blue-200 rounded px-1 truncate">
                      {e.subject}
                    </div>
                  ))}
                  {dayTodos.slice(0, 2).map((t) => (
                    <div key={t.id} className={`text-xs rounded px-1 truncate ${
                      t.completed ? "bg-gray-700 text-gray-500 line-through" : "bg-indigo-900 text-indigo-200"
                    }`}>
                      {t.text}
                    </div>
                  ))}
                  {(dayEvents.length + dayTodos.length) > 4 && (
                    <div className="text-xs text-gray-500">+{dayEvents.length + dayTodos.length - 4} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Day detail panel */}
        {selectedDay && (
          <div className="mt-6 bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-100">{format(selectedDay, "EEEE, MMMM d")}</h3>
              <div className="flex gap-2">
                {calendarConnected && (
                  <button
                    onClick={() => openNewEvent(selectedDay)}
                    className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg"
                  >
                    <Plus size={12} /> Add Event
                  </button>
                )}
                <button onClick={() => setSelectedDay(null)} className="text-gray-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>
            </div>

            {selectedItems && selectedItems.events.length === 0 && selectedItems.todos.length === 0 && (
              <p className="text-gray-600 text-sm">Nothing scheduled</p>
            )}

            {selectedItems && selectedItems.events.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Outlook Events</p>
                <div className="space-y-2">
                  {selectedItems.events.map((e) => (
                    <div key={e.id} className="flex items-start justify-between bg-gray-800 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm text-white">{e.subject}</p>
                        <p className="text-xs text-gray-400">
                          {format(parseISO(e.start.dateTime), "HH:mm")} – {format(parseISO(e.end.dateTime), "HH:mm")}
                        </p>
                      </div>
                      <button onClick={() => deleteEvent(e.id)} className="text-gray-600 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedItems && selectedItems.todos.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Action Items</p>
                <div className="space-y-2">
                  {selectedItems.todos.map((t) => (
                    <div key={t.id} className={`text-sm px-3 py-2 rounded-lg ${
                      t.completed ? "bg-gray-800 text-gray-500 line-through" : "bg-gray-800 text-gray-200"
                    }`}>
                      {t.text}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Event Modal */}
      {showNewEvent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">New Event</h3>
              <button onClick={() => setShowNewEvent(false)} className="text-gray-500 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                placeholder="Event title"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-2">
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={saveEvent}
                disabled={saving || !form.subject || !form.date}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? "Creating..." : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
