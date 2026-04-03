"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { LogOut, Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Moon, Sun, User as UserIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
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

import { Calendar, dateFnsLocalizer, View } from "react-big-calendar"
import { format, parse, startOfWeek, getDay, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns"
import { ptBR } from "date-fns/locale/pt-BR"
import "react-big-calendar/lib/css/react-big-calendar.css"
import "./calendar-custom.css"

const locales = {
  "pt-BR": ptBR,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

type CalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
  allDay?: boolean
}

export default function CalendarPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<CalendarEvent[]>([])

  // Modal 
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newEventTitle, setNewEventTitle] = useState("")
  const [newEventStart, setNewEventStart] = useState("")
  const [newEventEnd, setNewEventEnd] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Edit & Delete States
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Calendar Control States
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentView, setCurrentView] = useState<View>("week")

  // User States
  const { theme, setTheme } = useTheme()
  const [userEmail, setUserEmail] = useState("")

  const fetchEvents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("user_id", user.id)
      .order("start_time", { ascending: true })

    if (error) {
      console.error("Erro ao carregar eventos:", error)
      toast.error("Erro ao carregar os eventos")
      return
    }

    // Corrigir problema de fuso horário
    const mapped = data.map((item: any) => {
      const startDate = new Date(item.start_time)
      const endDate = new Date(item.end_time)

      // Verificar se é evento de dia inteiro (diferença de 24h ou mais)
      const diffInHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)
      const isAllDay = diffInHours >= 24 &&
        startDate.getHours() === 0 &&
        startDate.getMinutes() === 0 &&
        endDate.getHours() === 0 &&
        endDate.getMinutes() === 0

      return {
        id: item.id,
        title: item.title,
        start: startDate,
        end: endDate,
        allDay: isAllDay
      }
    })

    setEvents(mapped)
  }, [])

  useEffect(() => {
    let mounted = true

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session && mounted) {
        router.push("/login")
      } else if (session && mounted) {
        setUserEmail(session.user.email || "")
        setLoading(false)
        await fetchEvents()
      }
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session && mounted) {
          router.push("/login")
        } else if (session && mounted) {
          setUserEmail(session.user.email || "")
          setLoading(false)
          await fetchEvents()
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router, fetchEvents])

  const handleLogout = async () => {
    setLoading(true)
    await supabase.auth.signOut()
  }

  const resetForm = useCallback(() => {
    setNewEventTitle("")
    setNewEventStart("")
    setNewEventEnd("")
    setSelectedEventId(null)
  }, [])

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEventId(event.id)
    setNewEventTitle(event.title)
    
    // Formatar para exibição no input datetime-local
    setNewEventStart(format(event.start, "yyyy-MM-dd'T'HH:mm"))
    setNewEventEnd(format(event.end, "yyyy-MM-dd'T'HH:mm"))
    
    setIsModalOpen(true)
  }, [])

  const handleDeleteEvent = async () => {
    if (!selectedEventId) return
    setIsDeleting(true)

    try {
      const { error } = await supabase.from("events").delete().eq("id", selectedEventId)
      if (error) throw error

      setEvents((prev) => prev.filter((e) => e.id !== selectedEventId))
      toast.success("Evento excluído com sucesso!")
      setIsModalOpen(false)
      resetForm()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Erro ao excluir evento.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (!newEventTitle.trim()) {
        throw new Error("Por favor, informe o título do evento")
      }

      if (!newEventStart) {
        throw new Error("Por favor, informe a data e hora de início")
      }

      if (!newEventEnd) {
        throw new Error("Por favor, informe a data e hora de término")
      }

      let startDate = new Date(newEventStart)
      let endDate = new Date(newEventEnd)

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error("Datas inválidas")
      }

      // Corrigir problema de fuso horário para eventos de múltiplos dias
      // Se o usuário selecionou apenas data sem hora, considerar como início do dia
      if (newEventStart.length === 10) {
        startDate = new Date(`${newEventStart}T00:00:00`)
      }

      if (newEventEnd.length === 10) {
        endDate = new Date(`${newEventEnd}T23:59:59`)
      }

      if (startDate >= endDate) {
        throw new Error("O horário de término deve ser posterior ao de início")
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error("Usuário não autenticado. Por favor, faça login novamente.")
      }

      // Inserir ou Atualizar no banco
      let dataResult, errorResult

      if (selectedEventId) {
        const { data, error } = await supabase
          .from("events")
          .update({
            title: newEventTitle.trim(),
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString()
          })
          .eq("id", selectedEventId)
          .select()
          .single()
        dataResult = data
        errorResult = error
      } else {
        const { data, error } = await supabase
          .from("events")
          .insert({
            title: newEventTitle.trim(),
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            user_id: user.id
          })
          .select()
          .single()
        dataResult = data
        errorResult = error
      }

      if (errorResult) throw errorResult
      if (!dataResult) throw new Error("Nenhum dado retornado após operação")

      // Atualiza evento na lista
      const isAllDay = (endDate.getTime() - startDate.getTime()) >= (24 * 60 * 60 * 1000) &&
        startDate.getHours() === 0 && endDate.getHours() === 0

      setEvents(prev => {
        const novoEvento = {
          id: dataResult.id,
          title: dataResult.title,
          start: startDate,
          end: endDate,
          allDay: isAllDay
        }
        
        if (selectedEventId) {
          return prev.map(e => e.id === selectedEventId ? novoEvento : e)
        }
        return [...prev, novoEvento]
      })

      toast.success(selectedEventId ? "Evento atualizado com sucesso!" : "Evento salvo com sucesso!")

      // Limpar formulário e fechar modal
      setIsModalOpen(false)
      resetForm()

    } catch (err: any) {
      console.error("Erro no handleCreateEvent:", err)
      toast.error(err.message || "Falha desconhecida ao salvar evento")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Navegação Customizada
  const handleNext = useCallback(() => {
    if (currentView === "month") setCurrentDate(addMonths(currentDate, 1))
    else if (currentView === "week") setCurrentDate(addWeeks(currentDate, 1))
    else if (currentView === "day") setCurrentDate(addDays(currentDate, 1))
    else if (currentView === "agenda") setCurrentDate(addMonths(currentDate, 1))
  }, [currentView, currentDate])

  const handlePrev = useCallback(() => {
    if (currentView === "month") setCurrentDate(subMonths(currentDate, 1))
    else if (currentView === "week") setCurrentDate(subWeeks(currentDate, 1))
    else if (currentView === "day") setCurrentDate(subDays(currentDate, 1))
    else if (currentView === "agenda") setCurrentDate(subMonths(currentDate, 1))
  }, [currentView, currentDate])

  const handleToday = useCallback(() => {
    setCurrentDate(new Date())
  }, [])

  // Memorizar componentes para evitar re-renderizações desnecessárias
  const eventPropGetter = useCallback((event: CalendarEvent) => {
    if (event.allDay) {
      return {
        className: 'rbc-event-all-day',
        style: {
          backgroundColor: '#8b5cf6',
          borderColor: '#7c3aed'
        }
      }
    }
    return {}
  }, [])

  // Componente Customizado para o Evento visível ali na tela
  const CustomEvent = useCallback(({ event }: { event: CalendarEvent }) => {
    const diffInHours = (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60)
    const diffInDays = Math.ceil(diffInHours / 24)

    let infoExtra = ""
    if (event.allDay || diffInHours >= 24) {
      if (diffInDays > 1) {
        infoExtra = `${format(event.start, "d/MM")} a ${format(event.end, "d/MM")}`
      } else {
        infoExtra = "Dia Inteiro"
      }
    }

    return (
      <div className="flex flex-col h-full text-xs overflow-hidden leading-tight p-0.5">
        <span className="font-semibold truncate">{event.title}</span>
        {infoExtra && <span className="opacity-90 font-normal truncate text-[10px] mt-0.5">{infoExtra}</span>}
      </div>
    )
  }, [])

  // Memorizar o calendário para evitar re-renderizações
  const CalendarComponent = useMemo(() => (
    <Calendar
      localizer={localizer}
      events={events}
      startAccessor="start"
      endAccessor="end"
      culture="pt-BR"
      view={currentView}
      date={currentDate}
      onView={(newView) => setCurrentView(newView)}
      onNavigate={(newDate) => setCurrentDate(newDate)}
      onSelectEvent={handleSelectEvent}
      eventPropGetter={eventPropGetter}
      components={{
        toolbar: () => null,
        event: CustomEvent
      }}
      messages={{
        noEventsInRange: "Sem eventos neste período.",
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
      }}
      className="custom-calendar-theme flex-1 min-h-0"
    />
  ), [events, currentView, currentDate, eventPropGetter, CustomEvent, handleSelectEvent])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse">Carregando painel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/3" />

      <div className="flex-1 flex flex-col min-h-0 p-6 max-w-7xl mx-auto w-full gap-6 relative z-10">

        {/* Cabeçalho */}
        <header className="flex-none flex items-center justify-between bg-card/60 backdrop-blur-md border border-border/50 p-4 rounded-2xl">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl hidden sm:flex">
                <CalendarIcon className="w-6 h-6 text-primary" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-2xl font-bold tracking-tight">Calendário</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1 capitalize">
                  {currentView === 'day' 
                    ? format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR })
                    : format(currentDate, "MMMM yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>

            <div className="h-8 w-px bg-border/50 mx-2 hidden sm:block" />

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleToday} className="rounded-xl px-4 h-10 hidden md:flex">
                Hoje
              </Button>
              <div className="flex items-center gap-1 bg-secondary/30 rounded-xl p-1 border border-border/50">
                <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8 rounded-lg">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8 rounded-lg">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center bg-secondary/30 rounded-xl p-1 border border-border/50 ml-2">
                {(["month", "week", "day", "agenda"] as View[]).map((view) => (
                  <Button
                    key={view}
                    variant={currentView === view ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setCurrentView(view)}
                    className="h-8 px-3 rounded-lg text-xs capitalize"
                  >
                    {view === "month" ? "Mês" : view === "week" ? "Semana" : view === "day" ? "Dia" : "Agenda"}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Dialog 
              open={isModalOpen} 
              onOpenChange={(open) => {
                setIsModalOpen(open)
                if (!open) resetForm()
              }}
            >
              <DialogTrigger asChild>
                <Button className="gap-2 rounded-xl px-4 h-10">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Novo Evento</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{selectedEventId ? "Editar evento" : "Adicionar novo evento"}</DialogTitle>
                  <DialogDescription>
                    {selectedEventId ? "Modifique as informações do seu compromisso." : "Marque um compromisso no seu calendário e ele será salvo no Supabase."}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateEvent} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título do Evento</Label>
                    <Input
                      id="title"
                      placeholder="Ex: Call com a equipe"
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start">Início</Label>
                      <Input
                        id="start"
                        type="datetime-local"
                        value={newEventStart}
                        onChange={(e) => setNewEventStart(e.target.value)}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Para dia inteiro, selecione apenas a data
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end">Fim</Label>
                      <Input
                        id="end"
                        type="datetime-local"
                        value={newEventEnd}
                        onChange={(e) => setNewEventEnd(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter className="pt-4 flex !justify-between items-center sm:justify-between space-x-2">
                    {selectedEventId ? (
                      <Button 
                        type="button" 
                        variant="destructive" 
                        disabled={isDeleting}
                        onClick={handleDeleteEvent}
                        className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-white"
                      >
                        {isDeleting ? "Excluindo..." : "Excluir"}
                      </Button>
                    ) : (
                      <div />
                    )}
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Salvando..." : "Salvar Evento"}
                      </Button>
                    </div>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-xl h-10 px-4 hidden sm:flex border-border/50 bg-background/50">
                  <UserIcon className="w-4 h-4" />
                  <span className="max-w-[150px] truncate">{userEmail || "Perfil"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mt-2 rounded-xl">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Conta Conectada</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">{userEmail}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")} 
                  className="cursor-pointer gap-2"
                >
                  {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  <span>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout} 
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair da conta</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Container do calendário */}
        <main className="flex-1 min-h-0 bg-card/80 backdrop-blur-sm border border-border/50 rounded-3xl overflow-hidden p-6 ring-1 ring-white/5 flex flex-col">
          {CalendarComponent}
        </main>
      </div>
    </div>
  )
}