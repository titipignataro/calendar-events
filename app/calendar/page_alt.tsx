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

import dynamic from "next/dynamic"
import type FC from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import listPlugin from "@fullcalendar/list"
import interactionPlugin from "@fullcalendar/interaction"
import momentTimezonePlugin from "@fullcalendar/moment-timezone"
import moment from "moment-timezone"
import "moment/locale/pt-br"
import "./calendar-custom.css"

const FullCalendar = dynamic(() => import("@fullcalendar/react"), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-secondary/10 animate-pulse rounded-xl" />
})

moment.locale("pt-br")
moment.tz.setDefault("America/Sao_Paulo")

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarEvent = {
  id: string
  title: string
  start: string
  end: string
  allDay?: boolean
}

type FormState = {
  title: string
  start: string
  end: string
}

const EMPTY_FORM: FormState = { title: "", start: "", end: "" }

const VIEWS: { key: string; label: string }[] = [
  { key: "dayGridMonth", label: "Mês" },
  { key: "timeGridWeek", label: "Semana" },
  { key: "timeGridDay", label: "Dia" },
  { key: "listWeek", label: "Agenda" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapDbEvent(item: any): CalendarEvent {
  // Converte explicitamente do UTC do Supabase para o horário local de SP como string crua,
  // eliminando qualquer offset que faria o FullCalendar "pular" o evento para trás à meia-noite.
  const toLocal = (iso: string) => 
    moment.utc(iso).tz("America/Sao_Paulo").format("YYYY-MM-DDTHH:mm:ss")

  return {
    id: item.id,
    title: item.title,
    start: toLocal(item.start_time),
    end: toLocal(item.end_time),
    allDay: false, 
  }
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
const CustomEvent = (arg: any) => {
  const { event } = arg
  const start = event.start as Date
  const end = event.end as Date
  const isAllDay = event.allDay

  let sub = ""
  if (isAllDay || (end && (end.getTime() - start.getTime()) / 3_600_000 >= 24)) {
    sub = "Dia inteiro"
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
  const calendarRef = useRef<FC>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentView, setCurrentView] = useState("dayGridMonth")
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const displayEvents = useMemo(() => {
    return events.map(e => ({
      ...e,
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      allDay: e.allDay
    }))
  }, [events])

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

  const openEditEvent = useCallback((id: string, title: string, startStr: string, endStr: string) => {
    setSelectedEventId(id)
    setForm({
      title,
      start: startStr,
      end: endStr,
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

      const startDate = moment.tz(startStr, "America/Sao_Paulo").toDate()
      const endDate = moment.tz(endStr, "America/Sao_Paulo").toDate()

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
          .insert({ 
            title: title.trim(), 
            start_time: startDate.toISOString(), 
            end_time: endDate.toISOString(), 
            user_id: user.id 
          })
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
    calendarRef.current?.getApi().next()
  }, [])
 
  const handlePrev = useCallback(() => {
    calendarRef.current?.getApi().prev()
  }, [])
 
  const handleToday = useCallback(() => {
    calendarRef.current?.getApi().today()
  }, [])

  const handleViewChange = useCallback((viewKey: string) => {
    calendarRef.current?.getApi().changeView(viewKey)
    setCurrentView(viewKey)
  }, [])
 
  // ── Memo ───────────────────────────────────────────────────────────────────
 
  const eventPropGetter = useCallback((event: CalendarEvent) => {
    if (event.allDay) {
      return {
        style: { backgroundColor: "hsl(var(--primary))", borderColor: "transparent" },
      }
    }
    return {}
  }, [])
 
  const calendarLabel = useMemo(() => {
    const m = moment(currentDate)
    if (currentView === "timeGridDay") return m.format("dddd, D [de] MMMM")
    return m.format("MMMM YYYY")
  }, [currentDate, currentView])

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
            {moment(currentDate).isSame(moment(), 'day') && (
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
                onClick={() => handleViewChange(key)}
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
        <div className="h-full rounded-xl border border-border/40 overflow-hidden bg-background fc-theme-custom">
          {isMounted && (
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, momentTimezonePlugin]}
              initialView="dayGridMonth"
              timeZone="America/Sao_Paulo"
              locale="pt-br"
              events={displayEvents}
              headerToolbar={false}
              height="100%"
              dayMaxEvents={true}
              allDayText="Dia inteiro"
              buttonText={{
                today: "Hoje",
                month: "Mês",
                week: "Semana",
                day: "Dia",
                list: "Agenda"
              }}
              eventContent={CustomEvent}
              eventClick={(info) => {
                const ev = info.event
                
                const startIso = ev.startStr
                const endIso = ev.endStr || ev.startStr

                const startVal = startIso.length >= 16 ? startIso.substring(0, 16) : `${startIso.substring(0, 10)}T12:00`
                const endVal = endIso.length >= 16 ? endIso.substring(0, 16) : `${endIso.substring(0, 10)}T13:00`

                openEditEvent(ev.id, ev.title, startVal, endVal)
              }}
              dateClick={(info) => {
                setSelectedEventId(null)
                const startIso = info.dateStr
                const startVal = startIso.length >= 16 ? startIso.substring(0, 16) : `${startIso.substring(0, 10)}T12:00`
                const endVal = moment(startVal, "YYYY-MM-DDTHH:mm").add(1, 'hour').format("YYYY-MM-DDTHH:mm")

                setForm({
                  ...EMPTY_FORM,
                  start: startVal,
                  end: endVal,
                })
                setPanelOpen(true)
              }}
              datesSet={(arg) => {
                setCurrentDate(arg.view.currentStart)
                setCurrentView(arg.view.type)
              }}
            />
          )}
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