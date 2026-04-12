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
  List,
  LayoutGrid,
  Clock,
  Pencil,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarUI } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

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
  status: 'pending' | 'done'
  color: string
}

type FormState = {
  title: string
  start: string
  end: string
  allDay: boolean
  status: 'pending' | 'done'
  color: string
}

const EMPTY_FORM: FormState = {
  title: "",
  start: "",
  end: "",
  allDay: false,
  status: 'pending',
  color: '#534AB7'
}

const EVENT_COLORS = [
  { label: 'Roxo',   value: '#534AB7' },
  { label: 'Verde',  value: '#0F6E56' },
  { label: 'Coral',  value: '#993C1D' },
  { label: 'Azul',   value: '#185FA5' },
  { label: 'Âmbar',  value: '#854F0B' },
]

const VIEWS: { key: View; label: string }[] = [
  { key: "agenda", label: "Resumo" },
  { key: "month", label: "Mês" },
  { key: "week", label: "Semana" },
  { key: "day", label: "Dia" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

type DbEvent = { 
  id: string 
  title: string 
  start_time: string 
  end_time: string 
  all_day?: boolean 
  status?: 'pending' | 'done' 
  color?: string 
} 

function mapDbEvent(item: DbEvent): CalendarEvent { 
  return { 
    id: item.id, 
    title: item.title, 
    start: moment.tz(item.start_time, "America/Sao_Paulo").toDate(), 
    end:   moment.tz(item.end_time,   "America/Sao_Paulo").toDate(), 
    allDay: item.all_day || false, 
    status: item.status ?? 'pending', 
    color:  item.color  ?? '#534AB7', 
  } 
} 

const toLocal = (date: Date) => 
  moment(date).tz("America/Sao_Paulo") 
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
  onChange: (field: keyof FormState, value: any) => void
  onSubmit: (e: React.FormEvent) => void
  onDelete: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [startOpen, setStartOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)

  // Fechar ao clicar fora
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Element
      
      // Ignorar caso o clique tenha sido dentro de um dialog/popover do calendário (shadcn portal)
      if (target.closest('[data-slot="popover-content"]')) return

      if (panelRef.current && !panelRef.current.contains(target)) {
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
            className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground transition-colors cursor-pointer"
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

            <div className="flex items-center space-x-2 py-2">
              <Checkbox
                id="allDay"
                checked={form.allDay}
                onCheckedChange={(checked) => onChange("allDay", !!checked)}
              />
              <Label
                htmlFor="allDay"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Dia inteiro
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="start" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Início
              </Label>
              <div className="flex gap-2">
                <Popover open={startOpen} onOpenChange={setStartOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-10 text-sm bg-secondary/20 border-border/40 hover:bg-secondary/30 focus:ring-0 rounded-lg cursor-pointer flex-1 justify-start text-left font-normal",
                        !form.start && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {form.start && form.start.length >= 10 ? moment(form.start.substring(0, 10)).format("L") : <span>Selecionar data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[100]" align="start">
                    <CalendarUI
                      mode="single"
                      selected={form.start && form.start.length >= 10 ? moment(form.start.substring(0, 10)).toDate() : undefined}
                      onSelect={(date) => {
                        if (!date) return
                        const time = form.start && form.start.length >= 16 ? form.start.substring(11, 16) : "12:00"
                        onChange("start", `${moment(date).format("YYYY-MM-DD")}T${time}`)
                        setStartOpen(false)
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {!form.allDay && (
                  <Input
                    type="time"
                    value={form.start && form.start.length >= 16 ? form.start.substring(11, 16) : ""}
                    onChange={(e) => {
                      const date = form.start && form.start.length >= 10 ? form.start.substring(0, 10) : moment().format("YYYY-MM-DD")
                      onChange("start", `${date}T${e.target.value || "00:00"}`)
                    }}
                    required
                    className="h-10 text-sm bg-secondary/20 border-border/40 focus:border-primary/50 focus:ring-0 rounded-lg cursor-text w-[110px]"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="end" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Fim
              </Label>
              <div className="flex gap-2">
                <Popover open={endOpen} onOpenChange={setEndOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-10 text-sm bg-secondary/20 border-border/40 hover:bg-secondary/30 focus:ring-0 rounded-lg cursor-pointer flex-1 justify-start text-left font-normal",
                        !form.end && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {form.end && form.end.length >= 10 ? moment(form.end.substring(0, 10)).format("L") : <span>Selecionar data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[100]" align="start">
                    <CalendarUI
                      mode="single"
                      selected={form.end && form.end.length >= 10 ? moment(form.end.substring(0, 10)).toDate() : undefined}
                      onSelect={(date) => {
                        if (!date) return
                        const time = form.end && form.end.length >= 16 ? form.end.substring(11, 16) : "13:00"
                        onChange("end", `${moment(date).format("YYYY-MM-DD")}T${time}`)
                        setEndOpen(false)
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {!form.allDay && (
                  <Input
                    type="time"
                    value={form.end && form.end.length >= 16 ? form.end.substring(11, 16) : ""}
                    onChange={(e) => {
                      const date = form.end && form.end.length >= 10 ? form.end.substring(0, 10) : moment().format("YYYY-MM-DD")
                      onChange("end", `${date}T${e.target.value || "00:00"}`)
                    }}
                    required
                    className="h-10 text-sm bg-secondary/20 border-border/40 focus:border-primary/50 focus:ring-0 rounded-lg cursor-text w-[110px]"
                  />
                )}
              </div>
              <p className="text-[11px] mt-1 text-muted-foreground/60 leading-tight">
                {form.allDay ? "O evento durará o dia inteiro." : "Selecione o horário de término."}
              </p>
            </div>

            {/* Cor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cor</Label>
              <div className="flex gap-2">
                {EVENT_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => onChange("color", c.value)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      form.color === c.value ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ background: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* Status — só ao editar */}
            {selectedEventId && (
              <div className="flex items-center space-x-2 py-1">
                <Checkbox
                  id="status"
                  checked={form.status === 'done'}
                  onCheckedChange={(v) => onChange("status", v ? 'done' : 'pending')}
                />
                <Label htmlFor="status" className="text-sm cursor-pointer">Marcar como concluído</Label>
              </div>
            )}
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
      ? `${moment(event.start).format("D/MM")} – ${moment(event.end).format("D/MM")}`
      : "Dia inteiro"
  }

  return (
    <div className="flex flex-col h-full text-xs overflow-hidden leading-tight p-0.5">
      <span className="font-semibold truncate">{event.title}</span>
      {sub && <span className="opacity-75 truncate text-[10px] mt-0.5">{sub}</span>}
    </div>
  )
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

// Hook para persistir preferência de fonte 
function useFontSize() { 
  const STEPS = [85, 100, 115, 130] 
  const [step, setStep] = useState(1) 

  useEffect(() => { 
    const stored = Number(localStorage.getItem('agenda-font-step') ?? 1) 
    setStep(Math.min(Math.max(stored, 0), 3)) 
  }, []) 

  const changeFont = useCallback((d: number) => { 
    setStep(prev => { 
      const next = Math.min(Math.max(prev + d, 0), 3) 
      localStorage.setItem('agenda-font-step', String(next)) 
      return next 
    }) 
  }, []) 

  return { scale: STEPS[step], fontLabel: `${STEPS[step]}%`, changeFont } 
} 

const EVENT_COLORS_MAP: Record<string, string> = { 
  '#534AB7': '#EEEDFE', '#0F6E56': '#E1F5EE', 
  '#993C1D': '#FAECE7', '#185FA5': '#E6F1FB', '#854F0B': '#FAEEDA', 
} 

function AgendaView({ 
   events, 
   currentDate, 
   onSelectEvent, 
   onToggleStatus, 
   scale, 
 }: { 
   events: CalendarEvent[] 
   currentDate: Date 
   onSelectEvent: (e: CalendarEvent) => void 
   onToggleStatus: (id: string) => void 
   scale: number 
 }) { 
   const [viewMode, setViewMode] = useState<'list' | 'grid'>('list') 
 
   const todayStart    = moment().startOf("day") 
   const tomorrowEnd   = moment().add(1, "day").endOf("day") 
   const monthStart    = moment(currentDate).startOf("month") 
   const monthEnd      = moment(currentDate).endOf("month") 
 
   // Agrupa e separa em "hoje+amanhã" vs "próximos" 
   const { nearGroups, futureGroups } = useMemo(() => { 
     const filtered = events.filter(e => 
       moment(e.start).isBefore(monthEnd) && 
       moment(e.end).isAfter(monthStart) && 
       moment(e.start).isSameOrAfter(todayStart) 
     ) 
 
     const map = new Map<string, CalendarEvent[]>() 
     filtered.forEach(e => { 
       const key = toLocal(e.start).format("YYYY-MM-DD") 
       map.set(key, [...(map.get(key) ?? []), e]) 
     }) 
 
     const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)) 
 
     const near:   typeof sorted = [] 
     const future: typeof sorted = [] 
 
     sorted.forEach(([dateKey, evs]) => { 
       const d = moment(dateKey) 
       if (d.isSameOrBefore(tomorrowEnd, 'day')) { 
         near.push([dateKey, evs]) 
       } else { 
         future.push([dateKey, evs]) 
       } 
     }) 
 
     return { nearGroups: near, futureGroups: future } 
   }, [events, monthStart, monthEnd, todayStart, tomorrowEnd]) 
 
   function duration(e: CalendarEvent) { 
     if (e.allDay) return null 
     const mins = Math.round((e.end.getTime() - e.start.getTime()) / 60000) 
     if (mins < 60) return `${mins}min` 
     const h = Math.floor(mins / 60), m = mins % 60 
     return m > 0 ? `${h}h${m}` : `${h}h` 
   } 
 
   const totalNear   = nearGroups.reduce((acc, [, evs]) => acc + evs.length, 0) 
   const totalFuture = futureGroups.reduce((acc, [, evs]) => acc + evs.length, 0) 
 
   const isEmpty = nearGroups.length === 0 && futureGroups.length === 0 
 
   function renderDayBlock( 
     dateKey: string, 
     dayEvents: CalendarEvent[], 
     dimmed = false 
   ) { 
     const day     = moment(dateKey) 
     const isToday = day.isSame(moment(), "day") 
 
     return ( 
       <div key={dateKey} className={`mb-5 ${dimmed ? "opacity-70" : ""}`}> 
         {/* Cabeçalho do dia */} 
         <div className="flex items-baseline gap-2.5 mb-2"> 
           <span className={`font-medium leading-none ${ 
             isToday ? "text-4xl text-primary" : "text-3xl text-foreground" 
           }`}> 
             {day.format("D")} 
           </span> 
           <span className="text-xs text-muted-foreground capitalize"> 
             {day.format("dddd")} 
           </span> 
           <span className="text-[10px] text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full border border-border/20"> 
             {dayEvents.length} evento{dayEvents.length > 1 ? "s" : ""} 
           </span> 
         </div> 
 
         {/* Lista */} 
         {viewMode === "list" && ( 
           <div className="flex flex-col"> 
             {dayEvents.map(e => ( 
               <div 
                 key={e.id} 
                 className="group flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-secondary/30 transition-colors border-b border-border/[0.07] last:border-b-0 cursor-pointer" 
                 onClick={() => onSelectEvent(e)} 
               > 
                 <span className="w-2 h-2 rounded-full shrink-0" style={{ background: e.color }} /> 
                 <span className="text-xs text-muted-foreground min-w-[100px] shrink-0 tabular-nums"> 
                   {e.allDay 
                     ? "Dia inteiro" 
                     : `${toLocal(e.start).format("HH:mm")} – ${toLocal(e.end).format("HH:mm")}`} 
                 </span> 
                 <span className={`text-sm font-medium flex-1 truncate ${ 
                   e.status === "done" ? "line-through text-muted-foreground" : "" 
                 }`}> 
                   {e.title} 
                 </span> 
                 <div className="flex items-center gap-1.5 shrink-0"> 
                   {duration(e) && ( 
                     <span className="text-[11px] px-2 py-0.5 rounded-full border border-border/30 text-muted-foreground"> 
                       {duration(e)} 
                     </span> 
                   )} 
                   <button 
                     onClick={ev => { ev.stopPropagation(); onToggleStatus(e.id) }} 
                     className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-colors ${ 
                       e.status === "done" 
                         ? "bg-[#EAF3DE] text-[#27500A] border-[#C0DD97]" 
                         : "border-border/30 text-muted-foreground hover:border-border/60" 
                     }`} 
                   > 
                     {e.status === "done" ? "Concluído" : "Pendente"} 
                   </button> 
                 </div> 
               </div> 
             ))} 
           </div> 
         )} 
 
         {/* Grid */} 
         {viewMode === "grid" && ( 
           <div className={`grid gap-2.5 ${ 
             dayEvents.length === 1 ? "grid-cols-1" : 
             dayEvents.length === 2 ? "grid-cols-2" : "grid-cols-3" 
           }`}> 
             {dayEvents.map(e => ( 
               <div 
                 key={e.id} 
                 onClick={() => onSelectEvent(e)} 
                 className="relative bg-background border border-border/40 rounded-xl p-3 pl-4 cursor-pointer hover:border-border/70 transition-colors overflow-hidden" 
               > 
                 <div 
                   className="absolute left-0 top-0 bottom-0 w-[3px]" 
                   style={{ background: e.color, borderRadius: 0 }} 
                 /> 
                 <p className="text-[11px] text-muted-foreground mb-1 tabular-nums"> 
                   {e.allDay 
                     ? "Dia inteiro" 
                     : `${toLocal(e.start).format("HH:mm")} – ${toLocal(e.end).format("HH:mm")}`} 
                 </p> 
                 <p className={`text-sm font-medium mb-2 truncate ${ 
                   e.status === "done" ? "line-through text-muted-foreground" : "" 
                 }`}> 
                   {e.title} 
                 </p> 
                 <div className="flex flex-wrap gap-1.5"> 
                   {duration(e) && ( 
                     <span className="text-[11px] px-2 py-0.5 rounded-full border border-border/30 text-muted-foreground"> 
                       {duration(e)} 
                     </span> 
                   )} 
                   <button 
                     onClick={ev => { ev.stopPropagation(); onToggleStatus(e.id) }} 
                     className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-colors ${ 
                       e.status === "done" 
                         ? "bg-[#EAF3DE] text-[#27500A] border-[#C0DD97]" 
                         : "border-border/30 text-muted-foreground hover:border-border/60" 
                     }`} 
                   > 
                     {e.status === "done" ? "Concluído" : "Pendente"} 
                   </button> 
                 </div> 
               </div> 
             ))} 
           </div> 
         )} 
       </div> 
     ) 
   } 
 
   return ( 
     <div className="h-full overflow-y-auto" style={{ zoom: scale / 100 }}> 
 
       {/* ── Subcabeçalho sticky ── */} 
       <div className="sticky top-0 z-10 bg-background border-b border-border/30 flex items-center justify-between px-5 py-3"> 
         <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60"> 
           Resumo mensal
         </p>
         <div className="flex items-center bg-secondary/40 rounded-lg p-1 gap-1"> 
           {(["list", "grid"] as const).map(v => ( 
             <button 
               key={v} 
               onClick={() => setViewMode(v)} 
               className={`p-1.5 rounded-md transition-all cursor-pointer ${ 
                 viewMode === v 
                   ? "bg-background text-foreground border border-border/30" 
                   : "text-muted-foreground hover:text-foreground" 
               }`} 
             > 
               {v === "list" 
                 ? <List className="w-3.5 h-3.5" /> 
                 : <LayoutGrid className="w-3.5 h-3.5" />} 
             </button> 
           ))} 
         </div> 
       </div> 
 
       {isEmpty ? ( 
         <div className="flex flex-col items-center justify-center h-[calc(100%-48px)] text-muted-foreground gap-2"> 
           <CalendarIcon className="w-8 h-8 opacity-30" /> 
           <p className="text-sm">Nenhum evento a partir de hoje</p> 
         </div> 
       ) : ( 
         <div className="px-5 py-4 space-y-1"> 
 
           {/* ── Seção: Hoje & amanhã ── */} 
           {nearGroups.length > 0 && ( 
             <> 
               <div className="bg-background flex items-center gap-3 py-3"> 
                 <span className="text-[10px] font-bold uppercase tracking-widest text-primary whitespace-nowrap"> 
                   Hoje &amp; amanhã 
                 </span> 
                 <div className="flex-1 h-px bg-primary/20" /> 
                 <span className="text-[10px] text-muted-foreground whitespace-nowrap"> 
                   {totalNear} evento{totalNear !== 1 ? "s" : ""} 
                 </span> 
               </div> 
               {nearGroups.map(([dateKey, dayEvents]) => 
                 renderDayBlock(dateKey, dayEvents, false) 
               )} 
             </> 
           )} 
 
           {/* ── Seção: Próximos dias ── */} 
           {futureGroups.length > 0 && ( 
             <> 
               <div className="bg-background flex items-center gap-3 pt-5 pb-3"> 
                 <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap"> 
                   Próximos dias 
                 </span> 
                 <div className="flex-1 h-px bg-border/50" /> 
                 <span className="text-[10px] text-muted-foreground whitespace-nowrap"> 
                   {totalFuture} evento{totalFuture !== 1 ? "s" : ""} 
                 </span> 
               </div> 
               {futureGroups.map(([dateKey, dayEvents]) => 
                 renderDayBlock(dateKey, dayEvents, true) 
               )} 
             </> 
           )} 
 
         </div> 
       )} 
     </div> 
   ) 
 }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<CalendarEvent[]>([])

  const { scale, fontLabel, changeFont } = useFontSize()

  // Slide-over
  const [panelOpen, setPanelOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Calendário
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentView, setCurrentView] = useState<View>("agenda")

  function toSafeDate(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12, 0, 0
  )
}

   const displayEvents = useMemo(() => { 
  if (currentView !== "month") return events 
 
  return events.map(e => { 
    if (e.allDay) return e 
 
    return { 
      ...e, 
      start: toSafeDate(e.start), 
      end: toSafeDate(e.end), 
    } 
  }) 
 }, [events, currentView]) 

  // Usuário
  const { theme, setTheme } = useTheme()
  const [userEmail, setUserEmail] = useState("")

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      if (authError) {
        await supabase.auth.signOut()
        router.push("/login")
      }
      return
    }

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("user_id", session.user.id)
      .order("start_time", { ascending: true })

    if (error) {
      toast.error("Erro ao carregar eventos")
      return
    }

    setEvents(data.map(mapDbEvent))
  }, [router])

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
    // Como a view "month" muta a data para 12:00 em displayEvents, resgatamos o evento com a hora original
    const originalEvent = events.find(e => e.id === event.id) || event

    setSelectedEventId(originalEvent.id)
    setForm({
      title: originalEvent.title,
      start: moment(originalEvent.start).format("YYYY-MM-DDTHH:mm"),
      end: moment(originalEvent.end).format("YYYY-MM-DDTHH:mm"),
      allDay: originalEvent.allDay || false,
      status: originalEvent.status,
      color: originalEvent.color,
    })
    setPanelOpen(true)
  }, [events])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    // Resetar após animação
    setTimeout(() => {
      setSelectedEventId(null)
      setForm(EMPTY_FORM)
    }, 300)
  }, [])

  const handleFormChange = useCallback( 
    <K extends keyof FormState>(field: K, value: FormState[K]) => { 
      setForm(prev => ({ ...prev, [field]: value })) 
    }, 
    [] 
  ) 

  const handleLogout = useCallback(async () => {
    setLoading(true)
    await supabase.auth.signOut()
  }, [])

  const handleToggleStatus = useCallback(async (id: string) => { 
    setEvents(prev => { 
      const event = prev.find(e => e.id === id) 
      if (!event) return prev 
  
      const newStatus = event.status === 'done' ? 'pending' : 'done' 
  
      // atualização otimista 
      supabase 
        .from("events") 
        .update({ status: newStatus }) 
        .eq("id", id) 
        .then(({ error }) => { 
          if (error) { 
            toast.error("Erro ao atualizar status") 
          } 
        }) 
  
      return prev.map(e => 
        e.id === id ? { ...e, status: newStatus } : e 
      ) 
    }) 
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

      if (form.allDay) {
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
      }

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) throw new Error("Datas inválidas")
      if (startDate >= endDate) throw new Error("O fim deve ser posterior ao início")

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.user) throw new Error("Usuário não autenticado")
      const user = session.user

      let result: any, err: any

      if (selectedEventId) {
        ;({ data: result, error: err } = await supabase
          .from("events")
          .update({
            title: title.trim(),
            start_time: moment(startDate).toISOString(),
            end_time: moment(endDate).toISOString(),
            all_day: form.allDay,
            status: form.status,
            color: form.color
          })
          .eq("id", selectedEventId)
          .select()
          .single())
      } else {
        ;({ data: result, error: err } = await supabase
          .from("events")
          .insert({ 
            title: title.trim(), 
            start_time: moment(startDate).toISOString(), 
            end_time: moment(endDate).toISOString(), 
            user_id: user.id,
            all_day: form.allDay,
            status: form.status,
            color: form.color
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
    return {
      style: { backgroundColor: event.color, borderColor: "transparent" },
    }
  }, [])
 
  const isToday = moment(currentDate).isSame(moment(), 'day')
 
  const todayCount = useMemo(() =>
    events.filter(e => moment(e.start).isSame(moment(), 'day')).length
  , [events])

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
    agenda: "Resumo",
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
      <header className="flex-none grid grid-cols-3 items-center px-6 py-3 border-b border-border/40 bg-background/80 backdrop-blur-md">

        {/* Logo + label */} 
        <div className="flex items-center gap-2.5 justify-self-start min-w-0"> 
 
          {/* Ícone da Diária */} 
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0"> 
            <rect width="32" height="32" rx="8" fill="#534AB7"/> 
            <rect x="8" y="10" width="16" height="14" rx="2.5" fill="none" stroke="white" strokeWidth="1.5"/> 
            <line x1="8" y1="14.5" x2="24" y2="14.5" stroke="white" strokeWidth="1.5"/> 
            <line x1="12" y1="8" x2="12" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/> 
            <line x1="20" y1="8" x2="20" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/> 
            <rect x="11.5" y="17.5" width="3" height="3" rx="0.75" fill="white"/> 
            <rect x="17.5" y="17.5" width="3" height="3" rx="0.75" fill="white" opacity="0.5"/> 
          </svg> 
 
          {/* Nome fixo + label de mês */} 
          <span className="text-sm font-semibold tracking-tight text-foreground">Diária</span> 
          <span className="text-sm font-normal text-muted-foreground capitalize truncate hidden sm:block"> 
            {calendarLabel} 
          </span> 
 
          {isToday && ( 
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"> 
              Hoje 
            </span> 
          )} 
          {todayCount > 0 && ( 
            <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary text-primary-foreground"> 
              {todayCount} 
            </span> 
          )} 
        </div> 

        {/* Centro: Navegação + Tabs */}
        <div className="flex items-center gap-4 justify-self-center">
          {/* Navegação */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleToday}
              className="text-xs px-3 py-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors font-medium cursor-pointer"
            >
              Hoje
            </button>
            <div className="flex items-center">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="h-4 w-px bg-border/50" />

          {/* Seletor de view */}
          <div className="flex items-center bg-secondary/30 rounded-lg p-1">
            {VIEWS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setCurrentView(key)}
                className={`text-xs px-3 py-1.5 rounded-md transition-all font-medium cursor-pointer ${
                  currentView === key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Ações direitas */}
        <div className="flex items-center gap-2 justify-self-end">
          <button
            onClick={openNewEvent}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo evento
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors border border-border/30 cursor-pointer">
                <UserIcon className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl mt-2">
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

              <DropdownMenuItem asChild> 
                <div className="flex items-center justify-between px-2 py-1.5 cursor-default select-none"> 
                  <span className="text-sm text-muted-foreground">Tamanho do texto</span> 
                  <div className="flex items-center gap-1"> 
                    <button 
                      onClick={(e) => { e.stopPropagation(); changeFont(-1) }} 
                      className="w-6 h-6 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all cursor-pointer flex items-center justify-center" 
                    > 
                      A<sup className="text-[7px]">−</sup> 
                    </button> 
                    <span className="text-xs text-muted-foreground min-w-[32px] text-center">{fontLabel}</span> 
                    <button 
                      onClick={(e) => { e.stopPropagation(); changeFont(1) }} 
                      className="w-6 h-6 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all cursor-pointer flex items-center justify-center" 
                    > 
                      A<sup className="text-[7px]">+</sup> 
                    </button> 
                  </div> 
                </div> 
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
          {currentView === "agenda" ? (
            <AgendaView
              events={events}
              currentDate={currentDate}
              onSelectEvent={openEditEvent}
              onToggleStatus={handleToggleStatus}
              scale={scale}
            />
          ) : (
            <Calendar
              localizer={localizer}
              events={displayEvents}
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