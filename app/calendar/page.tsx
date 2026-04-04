"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  LogOut,
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  User as UserIcon,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { Calendar, momentLocalizer, View } from "react-big-calendar"
import moment from "moment-timezone"
import "moment/locale/pt-br"
import "react-big-calendar/lib/css/react-big-calendar.css"
import "./calendar-custom.css"

// ─── Localizer ────────────────────────────────────────────────────────────────

moment.locale("pt-br")
moment.tz.setDefault("America/Sao_Paulo")

const localizer = momentLocalizer(moment)

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
  allDay?: boolean
}

type FormState = {
  title: string
  start: string
  end: string
}

const EMPTY_FORM: FormState = { title: "", start: "", end: "" }

const VIEWS: { key: View; label: string }[] = [
  { key: "month", label: "Mês" },
  { key: "week", label: "Semana" },
  { key: "day", label: "Dia" },
  { key: "agenda", label: "Agenda" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAllDayEvent(start: Date, end: Date): boolean {
  const diffH = (end.getTime() - start.getTime()) / 3_600_000
  return (
    diffH >= 24 &&
    diffH % 24 === 0 &&
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    end.getHours() === 0 &&
    end.getMinutes() === 0
  )
}

function mapDbEvent(item: any): CalendarEvent {
  const start = moment(item.start_time).toDate()
  const end = moment(item.end_time).toDate()
  return { id: item.id, title: item.title, start, end, allDay: isAllDayEvent(start, end) }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground tracking-widest uppercase">Carregando</p>
      </div>
    </div>
  )
}

// Slide-over lateral para criar / editar evento
function EventSlideOver({
  open,
  form,
  selectedEventId,
  isSubmitting,
  isDeleting,
  onClose,
  onChange,
  onSubmit,
  onDelete,
}: {
  open: boolean
  form: FormState
  selectedEventId: string | null
  isSubmitting: boolean
  isDeleting: boolean
  onClose: () => void
  onChange: (field: keyof FormState, value: string) => void
  onSubmit: (e: React.FormEvent) => void
  onDelete: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Fechar ao clicar fora
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay para não capturar o clique que abriu
    const id = setTimeout(() => document.addEventListener("mousedown", handler), 50)
    return () => {
      clearTimeout(id)
      document.removeEventListener("mousedown", handler)
    }
  }, [open, onClose])

  // Fechar com Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Painel */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full w-[360px] z-50 bg-background border-l border-border/50 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Cabeçalho do painel */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/40">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              {selectedEventId ? "Editar evento" : "Novo evento"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedEventId ? "Altere os dados abaixo" : "Preencha os dados do compromisso"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-5 flex-1">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Título
              </Label>
              <Input
                id="title"
                placeholder="Ex: Reunião de equipe"
                value={form.title}
                onChange={(e) => onChange("title", e.target.value)}
                autoFocus
                required
                className="h-10 text-sm bg-secondary/20 border-border/40 focus:border-primary/50 focus:ring-0 rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="start" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Início
              </Label>
              <Input
                id="start"
                type="datetime-local"
                value={form.start}
                onChange={(e) => onChange("start", e.target.value)}
                required
                className="h-10 text-sm bg-secondary/20 border-border/40 focus:border-primary/50 focus:ring-0 rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="end" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Fim
              </Label>
              <Input
                id="end"
                type="datetime-local"
                value={form.end}
                onChange={(e) => onChange("end", e.target.value)}
                required
                className="h-10 text-sm bg-secondary/20 border-border/40 focus:border-primary/50 focus:ring-0 rounded-lg"
              />
              <p className="text-[11px] text-muted-foreground/60">
                Para evento de dia inteiro, selecione 00:00 em ambos e em dias diferentes
              </p>
            </div>
          </div>

          {/* Rodapé do painel */}
          <div className="px-6 py-5 border-t border-border/40 space-y-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 text-sm font-medium rounded-lg"
            >
              {isSubmitting ? "Salvando..." : selectedEventId ? "Salvar alterações" : "Criar evento"}
            </Button>

            {selectedEventId && (
              <Button
                type="button"
                variant="ghost"
                disabled={isDeleting}
                onClick={onDelete}
                className="w-full h-10 text-sm text-destructive hover:text-destructive hover:bg-destructive/8 rounded-lg gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? "Excluindo..." : "Excluir evento"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </>
  )
}

// Custom event card renderizado dentro do calendário
const CustomEvent = ({ event }: { event: CalendarEvent }) => {
  const diffH = (event.end.getTime() - event.start.getTime()) / 3_600_000
  const diffDays = Math.ceil(diffH / 24)

  let sub = ""
  if (event.allDay || diffH >= 24) {
    sub = diffDays > 1
      ? `${format(event.start, "d/MM")} – ${format(event.end, "d/MM")}`
      : "Dia inteiro"
  }

  return (
    <div className="flex flex-col h-full text-xs overflow-hidden leading-tight p-0.5">
      <span className="font-semibold truncate">{event.title}</span>
      {sub && <span className="opacity-75 truncate text-[10px] mt-0.5">{sub}</span>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<CalendarEvent[]>([])

  // Slide-over
  const [panelOpen, setPanelOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Calendário
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentView, setCurrentView] = useState<View>("week")

  // Usuário
  const { theme, setTheme } = useTheme()
  const [userEmail, setUserEmail] = useState("")

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("user_id", user.id)
      .order("start_time", { ascending: true })

    if (error) {
      toast.error("Erro ao carregar eventos")
      return
    }

    setEvents(data.map(mapDbEvent))
  }, [])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        if (mounted) router.push("/login")
        return
      }
      if (mounted) {
        setUserEmail(session.user.email ?? "")
        setLoading(false)
        await fetchEvents()
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (!session && mounted) return router.push("/login")
      if (session && mounted) {
        setUserEmail(session.user.email ?? "")
        setLoading(false)
        fetchEvents()
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router, fetchEvents])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const openNewEvent = useCallback(() => {
    setSelectedEventId(null)
    setForm(EMPTY_FORM)
    setPanelOpen(true)
  }, [])

  const openEditEvent = useCallback((event: CalendarEvent) => {
    setSelectedEventId(event.id)
    setForm({
      title: event.title,
      start: moment(event.start).format("YYYY-MM-DDTHH:mm"),
      end: moment(event.end).format("YYYY-MM-DDTHH:mm"),
    })
    setPanelOpen(true)
  }, [])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    // Resetar após animação
    setTimeout(() => {
      setSelectedEventId(null)
      setForm(EMPTY_FORM)
    }, 300)
  }, [])

  const handleFormChange = useCallback((field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleLogout = useCallback(async () => {
    setLoading(true)
    await supabase.auth.signOut()
  }, [])

  const handleDeleteEvent = useCallback(async () => {
    if (!selectedEventId) return
    setIsDeleting(true)
    try {
      const { error } = await supabase.from("events").delete().eq("id", selectedEventId)
      if (error) throw error
      setEvents((prev) => prev.filter((e) => e.id !== selectedEventId))
      toast.success("Evento excluído")
      closePanel()
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao excluir evento")
    } finally {
      setIsDeleting(false)
    }
  }, [selectedEventId, closePanel])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const { title, start: startStr, end: endStr } = form

      if (!title.trim()) throw new Error("Informe o título do evento")
      if (!startStr) throw new Error("Informe a data de início")
      if (!endStr) throw new Error("Informe a data de fim")

      const startDate = moment(startStr).toDate()
      const endDate = moment(endStr).toDate()

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) throw new Error("Datas inválidas")
      if (startDate >= endDate) throw new Error("O fim deve ser posterior ao início")

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error("Usuário não autenticado")

      let result: any, err: any

      if (selectedEventId) {
        ;({ data: result, error: err } = await supabase
          .from("events")
          .update({
            title: title.trim(),
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
          })
          .eq("id", selectedEventId)
          .select()
          .single())
      } else {
        ;({ data: result, error: err } = await supabase
          .from("events")
          .insert({ title: title.trim(), start_time: startDate.toISOString(), end_time: endDate.toISOString(), user_id: user.id })
          .select()
          .single())
      }

      if (err) throw err
      if (!result) throw new Error("Nenhum dado retornado")

      const newEvent = mapDbEvent(result)

      setEvents((prev) =>
        selectedEventId
          ? prev.map((e) => (e.id === selectedEventId ? newEvent : e))
          : [...prev, newEvent]
      )

      toast.success(selectedEventId ? "Evento atualizado" : "Evento criado")
      closePanel()
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar evento")
    } finally {
      setIsSubmitting(false)
    }
  }, [form, selectedEventId, closePanel])

  // ── Navegação ──────────────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    setCurrentDate((d) => {
      const m = moment(d)
      if (currentView === "month" || currentView === "agenda") return m.add(1, "months").toDate()
      if (currentView === "week") return m.add(1, "weeks").toDate()
      return m.add(1, "days").toDate()
    })
  }, [currentView])
 
  const handlePrev = useCallback(() => {
    setCurrentDate((d) => {
      const m = moment(d)
      if (currentView === "month" || currentView === "agenda") return m.subtract(1, "months").toDate()
      if (currentView === "week") return m.subtract(1, "weeks").toDate()
      return m.subtract(1, "days").toDate()
    })
  }, [currentView])
 
  const handleToday = useCallback(() => setCurrentDate(new Date()), [])
 
  // ── Memo ───────────────────────────────────────────────────────────────────
 
  const eventPropGetter = useCallback((event: CalendarEvent) => {
    if (event.allDay) {
      return {
        style: { backgroundColor: "hsl(var(--primary))", borderColor: "transparent" },
      }
    }
    return {}
  }, [])
 
  const isToday = moment(currentDate).isSame(moment(), 'day')
 
  const calendarLabel = useMemo(() => {
    const m = moment(currentDate)
    if (currentView === "day") return m.format("dddd, D [de] MMMM")
    if (currentView === "week") {
      const weekStart = m.clone().startOf("week")
      return weekStart.format("MMMM YYYY")
    }
    return m.format("MMMM YYYY")
  }, [currentDate, currentView])

  const calendarMessages = useMemo(() => ({
    noEventsInRange: "Nenhum evento neste período.",
    allDay: "Dia inteiro",
    previous: "Anterior",
    next: "Próximo",
    today: "Hoje",
    month: "Mês",
    week: "Semana",
    day: "Dia",
    agenda: "Agenda",
    date: "Data",
    time: "Hora",
    event: "Evento",
  }), [])

  const calendarComponents = useMemo(() => ({
    toolbar: () => null,
    event: CustomEvent,
  }), [])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Spinner />

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">

      {/* ── Header ── */}
      <header className="flex-none flex items-center justify-between px-6 py-3 border-b border-border/40 bg-background/80 backdrop-blur-md">

        {/* Logo + label */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <CalendarIcon className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold tracking-tight capitalize">{calendarLabel}</span>
            {isToday && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                Hoje
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-border/50" />

          {/* Navegação */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleToday}
              className="text-xs px-3 py-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              Hoje
            </button>
            <div className="flex items-center">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Seletor de view */}
          <div className="flex items-center bg-secondary/30 rounded-lg p-0.5 border border-border/30">
            {VIEWS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setCurrentView(key)}
                className={`text-xs px-3 py-1.5 rounded-md transition-all font-medium ${
                  currentView === key
                    ? "bg-background text-foreground shadow-sm border border-border/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Ações direitas */}
        <div className="flex items-center gap-2">
          <button
            onClick={openNewEvent}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo evento
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors border border-border/30">
                <UserIcon className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl mt-2">
              <DropdownMenuLabel className="font-normal py-2">
                <p className="text-xs font-medium">Conta</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{userEmail}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="cursor-pointer gap-2 text-sm"
              >
                {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                {theme === "dark" ? "Modo claro" : "Modo escuro"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer gap-2 text-sm text-destructive focus:text-destructive focus:bg-destructive/8"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Calendário ── */}
      <main className="flex-1 min-h-0 p-4">
        <div className="h-full rounded-xl border border-border/40 overflow-hidden bg-background">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            culture="pt-br"
            view={currentView}
            date={currentDate}
            onView={setCurrentView}
            onNavigate={setCurrentDate}
            onSelectEvent={openEditEvent}
            eventPropGetter={eventPropGetter}
            components={calendarComponents}
            messages={calendarMessages}
            className="custom-calendar-theme h-full"
          />
        </div>
      </main>

      {/* ── Slide-over ── */}
      <EventSlideOver
        open={panelOpen}
        form={form}
        selectedEventId={selectedEventId}
        isSubmitting={isSubmitting}
        isDeleting={isDeleting}
        onClose={closePanel}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        onDelete={handleDeleteEvent}
      />
    </div>
  )
}