"use client"

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  memo,
  type FormEvent,
} from "react"
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
  Users,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"

import { Calendar, momentLocalizer, View } from "react-big-calendar"
import moment from "moment-timezone"
import "moment/locale/pt-br"
import "react-big-calendar/lib/css/react-big-calendar.css"
import "./calendar-custom.css"
import "@/lib/i18n"
import { useTranslation } from "react-i18next"

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
  clientIds: string[]
}

type FormState = {
  title: string
  start: string
  end: string
  allDay: boolean
  status: 'pending' | 'done'
  color: string
  clientIds: string[]
}

const EMPTY_FORM: FormState = {
  title: "",
  start: "",
  end: "",
  allDay: false,
  status: 'pending',
  color: '#534AB7',
  clientIds: []
}

const EVENT_COLORS = [
  { label: 'Roxo',   value: '#534AB7' },
  { label: 'Verde',  value: '#0F6E56' },
  { label: 'Coral',  value: '#993C1D' },
  { label: 'Azul',   value: '#185FA5' },
  { label: 'Âmbar',  value: '#854F0B' },
]

const VIEWS: { key: View; labelKey: string }[] = [
  { key: "agenda", labelKey: "calendar.agenda" },
  { key: "month", labelKey: "calendar.month" },
  { key: "week", labelKey: "calendar.week" },
  { key: "day", labelKey: "calendar.day" },
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
  event_clients?: { client_id: string }[]
}

type ClientRow = {
  id: string
  user_id: string
  name: string
  process_number: string | null
  area: string | null
  date: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
  updated_at?: string | null
}

const EMPTY_CLIENT_FORM = { name: "", email: "", phone: "", notes: "" }

function mapDbEvent(item: DbEvent): CalendarEvent { 
  return { 
    id: item.id, 
    title: item.title, 
    start: moment.tz(item.start_time, "America/Sao_Paulo").toDate(), 
    end:   moment.tz(item.end_time,   "America/Sao_Paulo").toDate(), 
    allDay: item.all_day || false, 
    status: item.status ?? 'pending', 
    color:  item.color  ?? '#534AB7', 
    clientIds: item.event_clients?.map(ec => ec.client_id) || []
  } 
} 

const toLocal = (date: Date) => 
  moment(date).tz("America/Sao_Paulo") 
// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground tracking-widest uppercase">{t("calendar.loading")}</p>
      </div>
    </div>
  )
}

// Slide-over lateral para criar / editar evento (memo: evita reconciliação pesada quando o pai atualiza)
const EventSlideOver = memo(function EventSlideOver({
  open,
  form,
  selectedEventId,
  isSubmitting,
  isDeleting,
  clients,
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
  clients: ClientRow[]
  onClose: () => void
  onChange: (field: keyof FormState, value: any) => void
  onSubmit: (e: React.FormEvent) => void
  onDelete: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
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
      {/* Overlay — sem backdrop-blur (muito pesado sem GPU) */}
      <div
        className={`fixed inset-0 z-40 bg-black/35 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      />

      {/* Painel — transform em camada composta */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full w-full max-w-[min(100vw,360px)] z-50 bg-background border-l border-border/50 shadow-2xl flex flex-col transform-gpu will-change-transform transition-transform duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Cabeçalho do painel */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/40">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              {selectedEventId ? t("calendar.editEvent") : t("calendar.newEvent")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedEventId ? t("calendar.changeDetails") : t("calendar.fillDetails")}
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
                {t("calendar.title")}
              </Label>
              <Input
                id="title"
                placeholder={t("calendar.titlePlaceholder")}
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
                {t("calendar.allDay")}
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="start" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("calendar.start")}
              </Label>
              <div className="flex flex-wrap gap-2">
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
                      {form.start && form.start.length >= 10 ? moment(form.start.substring(0, 10)).format("L") : <span>{t("calendar.selectDate")}</span>}
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
                {t("calendar.end")}
              </Label>
              <div className="flex flex-wrap gap-2">
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
                      {form.end && form.end.length >= 10 ? moment(form.end.substring(0, 10)).format("L") : <span>{t("calendar.selectDate")}</span>}
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
                {form.allDay ? t("calendar.allDayDescription") : t("calendar.endTimeDescription")}
              </p>
            </div>

            {/* Cor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("calendar.color")}</Label>
              <div className="flex flex-wrap gap-2">
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

            {/* Clientes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("calendar.clients")}</Label>
              <div className="bg-secondary/10 border border-border/40 rounded-lg max-h-40 overflow-y-auto p-1.5 flex flex-col gap-0.5">
                {clients.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground p-2 text-center leading-tight">Nenhum cliente cadastrado.</p>
                ) : (
                  clients.map(c => (
                    <label key={c.id} className="flex items-start gap-2.5 p-2 hover:bg-secondary/40 rounded-md cursor-pointer transition-colors select-none">
                      <Checkbox
                        className="mt-0.5"
                        checked={form.clientIds.includes(c.id)}
                        onCheckedChange={(checked) => {
                          const newIds = checked
                            ? [...form.clientIds, c.id]
                            : form.clientIds.filter(id => id !== c.id)
                          onChange("clientIds", newIds)
                        }}
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[13px] font-medium leading-none truncate">{c.name}</span>
                        {c.process_number && <span className="text-[10px] text-muted-foreground truncate mt-1 leading-none">{c.process_number}</span>}
                      </div>
                    </label>
                  ))
                )}
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
                <Label htmlFor="status" className="text-sm cursor-pointer">{t("calendar.markAsDone")}</Label>
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
              {isSubmitting ? t("calendar.saving") : selectedEventId ? t("calendar.saveChanges") : t("calendar.createEvent")}
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
                {isDeleting ? t("calendar.deleting") : t("calendar.deleteEvent")}
              </Button>
            )}
          </div>
        </form>
      </div>
    </>
  )
})

// Custom event card renderizado dentro do calendário
const CustomEvent = ({ event }: { event: CalendarEvent }) => {
  const { t } = useTranslation()
  const diffH = (event.end.getTime() - event.start.getTime()) / 3_600_000
  const diffDays = Math.ceil(diffH / 24)

  let sub = ""
  if (event.allDay || diffH >= 24) {
    sub = diffDays > 1
      ? `${moment(event.start).format("D/MM")} – ${moment(event.end).format("D/MM")}`
      : t("calendar.allDay")
  }

  return (
    <div className="flex flex-col h-full text-xs overflow-hidden leading-tight p-0.5">
      <span className="font-semibold truncate">{event.title}</span>
      {sub && <span className="opacity-75 truncate text-[10px] mt-0.5">{sub}</span>}
    </div>
  )
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Escala em %; o tamanho base na página do calendário é 18px (16px + 2px) no passo 100%. */
function useFontSize() {
  const STEPS = [85, 100, 115, 130]
  const [step, setStep] = useState(1)

  useEffect(() => {
    const stored = Number(localStorage.getItem("agenda-font-step") ?? 1)
    setStep(Math.min(Math.max(stored, 0), 3))
  }, [])

  const changeFont = useCallback((d: number) => {
    setStep((prev) => {
      const next = Math.min(Math.max(prev + d, 0), 3)
      localStorage.setItem("agenda-font-step", String(next))
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
}: {
  events: CalendarEvent[]
  currentDate: Date
  onSelectEvent: (e: CalendarEvent) => void
  onToggleStatus: (id: string) => void
}) {
   const { t } = useTranslation()
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
         <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 mb-2"> 
           <span className={`font-medium leading-none ${ 
             isToday ? "text-4xl text-primary" : "text-3xl text-foreground" 
           }`}> 
             {day.format("D")} 
           </span> 
           <span className="text-xs text-muted-foreground capitalize"> 
             {day.format("dddd")} 
           </span> 
           <span className="text-[10px] text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full border border-border/20"> 
             {t("calendar.eventsCount", { count: dayEvents.length })}
           </span> 
         </div> 
 
         {/* Lista */} 
         {viewMode === "list" && ( 
           <div className="flex flex-col"> 
             {dayEvents.map(e => ( 
               <div 
                 key={e.id} 
                 className="group flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2.5 rounded-lg hover:bg-secondary/30 transition-colors border-b border-border/[0.07] last:border-b-0 cursor-pointer min-w-0" 
                 onClick={() => onSelectEvent(e)} 
               > 
                 <span className="w-2 h-2 rounded-full shrink-0" style={{ background: e.color }} /> 
                 <span className="text-xs text-muted-foreground min-w-[100px] shrink-0 tabular-nums"> 
                   {e.allDay 
                     ? t("calendar.allDay") 
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
                     {e.status === "done" ? t("calendar.done") : t("calendar.pending")} 
                   </button> 
                 </div> 
               </div> 
             ))} 
           </div> 
         )} 
 
         {/* Grid */} 
         {viewMode === "grid" && ( 
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 justify-items-center"> 
             {dayEvents.map(e => ( 
               <div 
                 key={e.id} 
                 onClick={() => onSelectEvent(e)} 
                 className="relative w-full max-w-sm min-w-0 bg-background border border-border/40 rounded-xl p-3 pl-4 cursor-pointer hover:border-border/70 transition-colors overflow-hidden" 
               > 
                 <div 
                   className="absolute left-0 top-0 bottom-0 w-[3px]" 
                   style={{ background: e.color, borderRadius: 0 }} 
                 /> 
                 <p className="text-[11px] text-muted-foreground mb-1 tabular-nums"> 
                   {e.allDay 
                     ? t("calendar.allDay") 
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
                     {e.status === "done" ? t("calendar.done") : t("calendar.pending")} 
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
     <div className="h-full overflow-y-auto">
 
       {/* ── Subcabeçalho sticky ── */} 
       <div className="sticky top-0 z-10 bg-background border-b border-border/30 flex flex-wrap items-center justify-between gap-x-2 gap-y-2 px-5 py-3"> 
         <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60"> 
           {t("calendar.monthlySummary")}
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
           <p className="text-sm">{t("calendar.noEventsFound")}</p> 
         </div> 
       ) : ( 
         <div className="px-5 py-4 space-y-1"> 
 
           {/* ── Seção: Hoje & amanhã ── */} 
           {nearGroups.length > 0 && ( 
             <> 
               <div className="bg-background flex flex-wrap items-center gap-x-3 gap-y-1 py-3"> 
                 <span className="text-[10px] font-bold uppercase tracking-widest text-primary whitespace-nowrap"> 
                   {t("calendar.todayAndTomorrow")}
                 </span> 
                 <div className="flex-1 h-px bg-primary/20" /> 
                 <span className="text-[10px] text-muted-foreground whitespace-nowrap"> 
                   {t("calendar.eventsCount", { count: totalNear })}
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
               <div className="bg-background flex flex-wrap items-center gap-x-3 gap-y-1 pt-5 pb-3"> 
                 <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap"> 
                   {t("calendar.upcomingDays")}
                 </span> 
                 <div className="flex-1 h-px bg-border/50" /> 
                 <span className="text-[10px] text-muted-foreground whitespace-nowrap"> 
                   {t("calendar.eventsCount", { count: totalFuture })} 
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

function ClientsSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [list, setList] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_CLIENT_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", session.user.id)
        .order("name", { ascending: true })
      if (error) throw error
      setList((data as ClientRow[]) ?? [])
    } catch {
      toast.error("Erro ao carregar clientes. Rode a migration em supabase/migrations se ainda não criou a tabela.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const resetForm = useCallback(() => {
    setForm(EMPTY_CLIENT_FORM)
    setEditingId(null)
  }, [])

  useEffect(() => {
    if (!open) resetForm()
  }, [open, resetForm])

  const handleEdit = useCallback((c: ClientRow) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      notes: c.notes ?? "",
    })
  }, [])

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!form.name.trim()) {
        toast.error(t("calendar.nameRequired"))
        return
      }
      setSaving(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) throw new Error("Sessão expirada")

        const payload = {
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          notes: form.notes.trim() || null,
        }

        if (editingId) {
          const { error } = await supabase
            .from("clients")
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq("id", editingId)
            .eq("user_id", session.user.id)
          if (error) throw error
          toast.success(t("calendar.clientUpdated"))
        } else {
          const { error } = await supabase
            .from("clients")
            .insert({ ...payload, user_id: session.user.id })
          if (error) throw error
          toast.success(t("calendar.clientCreated"))
        }
        resetForm()
        await load()
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar")
      } finally {
        setSaving(false)
      }
    },
    [form, editingId, load, resetForm],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm(t("calendar.deleteClientConfirm") as string)) return
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        const { error } = await supabase
          .from("clients")
          .delete()
          .eq("id", id)
          .eq("user_id", session.user.id)
        if (error) throw error
        toast.success(t("calendar.clientDeleted"))
        if (editingId === id) resetForm()
        await load()
      } catch {
        toast.error("Erro ao excluir")
      }
    },
    [load, editingId, resetForm],
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="space-y-1 border-b border-border/40 p-4 text-left">
          <SheetTitle>{t("calendar.clients")}</SheetTitle>
          <SheetDescription>
            {t("calendar.clientsDescription")}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 border-b border-border/40 p-4"
        >
          <p className="text-xs font-medium text-muted-foreground">
            {editingId ? t("calendar.editingClient") : t("calendar.newClient")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="client-name">{t("calendar.name")}</Label>
              <Input
                id="client-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("calendar.namePlaceholder")}
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-email">{t("calendar.email")}</Label>
              <Input
                id="client-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder={t("calendar.optional")}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-phone">{t("calendar.phone")}</Label>
              <Input
                id="client-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder={t("calendar.optional")}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="client-notes">{t("calendar.notes")}</Label>
              <Textarea
                id="client-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t("calendar.optional")}
                rows={2}
                className="min-h-[4rem] resize-y text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={saving} className="cursor-pointer">
              {saving ? t("calendar.saving") : editingId ? t("calendar.saveChanges") : t("calendar.addClient")}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={resetForm}
              >
                {t("calendar.cancelEdit")}
              </Button>
            )}
          </div>
        </form>

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {loading ? t("calendar.loading") : t("calendar.clientsCount", { count: list.length })}
          </p>
          <ScrollArea className="h-[min(50vh,24rem)] rounded-lg border border-border/40">
            <ul className="divide-y divide-border/40 p-1">
              {!loading &&
                list.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-col gap-1.5 px-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 cursor-pointer px-2"
                        onClick={() => handleEdit(c)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 cursor-pointer px-2 text-destructive hover:text-destructive"
                        onClick={() => void handleDelete(c.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Área do calendário isolada com memo: não re-renderiza o Big Calendar ao digitar no slide-over. */
type CalendarWorkAreaProps = {
  currentView: View
  events: CalendarEvent[]
  displayEvents: CalendarEvent[]
  currentDate: Date
  setCurrentView: (v: View) => void
  setCurrentDate: (d: Date) => void
  openEditEvent: (e: CalendarEvent) => void
  onToggleStatus: (id: string) => void
  eventPropGetter: (event: CalendarEvent) => { style: React.CSSProperties }
  calendarComponents: { toolbar: () => null; event: typeof CustomEvent }
  calendarMessages: Record<string, string>
}

const CalendarWorkArea = memo(function CalendarWorkArea({
  currentView,
  events,
  displayEvents,
  currentDate,
  setCurrentView,
  setCurrentDate,
  openEditEvent,
  onToggleStatus,
  eventPropGetter,
  calendarComponents,
  calendarMessages,
}: CalendarWorkAreaProps) {
  return (
    <main className="flex-1 min-h-0 p-3 sm:p-4">
      <div className="h-full rounded-xl border border-border/40 overflow-hidden bg-background">
        {currentView === "agenda" ? (
          <AgendaView
            events={events}
            currentDate={currentDate}
            onSelectEvent={openEditEvent}
            onToggleStatus={onToggleStatus}
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
  )
})

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<CalendarEvent[]>([])

  const { scale, fontLabel, changeFont } = useFontSize()

  useEffect(() => {
    const px = (18 * scale) / 100
    document.documentElement.style.fontSize = `${px}px`
    return () => {
      document.documentElement.style.fontSize = ""
    }
  }, [scale])

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

  const { theme, setTheme } = useTheme()
  const [userEmail, setUserEmail] = useState("")
  const [clients, setClients] = useState<ClientRow[]>([])

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
      .select('*, event_clients(client_id)')
      .eq("user_id", session.user.id)
      .order("start_time", { ascending: true })

    if (error) {
      toast.error("Erro ao carregar eventos")
      return
    }

    setEvents(data.map(mapDbEvent))
  }, [router])

  const fetchClients = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", session.user.id)
      .order("name", { ascending: true })
    setClients((data as ClientRow[]) ?? [])
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
        await Promise.all([fetchEvents(), fetchClients()])
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
      clientIds: originalEvent.clientIds || [],
    })
    setPanelOpen(true)
  }, [events])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    // Resetar após animação (alinhar à duração do painel)
    setTimeout(() => {
      setSelectedEventId(null)
      setForm(EMPTY_FORM)
    }, 220)
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

      const eventId = result.id
      
      // Associações de Clientes (NxN)
      if (selectedEventId) {
        await supabase.from("event_clients").delete().eq("event_id", eventId)
      }
      
      if (form.clientIds.length > 0) {
        const clientLinks = form.clientIds.map(cid => ({ event_id: eventId, client_id: cid }))
        await supabase.from("event_clients").insert(clientLinks)
      }

      // Re-busca o evento com os clientes
      const { data: updatedEvent, error: fetchErr } = await supabase
        .from("events")
        .select("*, event_clients(client_id)")
        .eq("id", eventId)
        .single()
        
      if (!fetchErr && updatedEvent) {
          result = updatedEvent
      }

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
    noEventsInRange: t("calendar.noEventsInRange"),
    showMore: (total: number) => t("calendar.showMore", { count: total }),
    allDay: t("calendar.allDay"),
    previous: t("calendar.previous"),
    next: t("calendar.next"),
    today: t("calendar.today"),
    month: t("calendar.month"),
    week: t("calendar.week"),
    day: t("calendar.day"),
    agenda: t("calendar.agenda"),
    date: t("calendar.date"),
    time: t("calendar.time"),
    event: t("calendar.event"),
  }), [t])

  const calendarComponents = useMemo(() => ({
    toolbar: () => null,
    event: CustomEvent,
  }), [])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Spinner />

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">

      {/* ── Header ── */}
      <header className="flex-none grid grid-cols-1 gap-y-3 px-4 py-3 border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-y-2">

        {/* Logo + label */} 
        <div className="flex flex-wrap items-center gap-2 min-w-0 justify-self-start"> 
 
          {/* Ícone da Diária */} 
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-5 shrink-0"> 
            <rect width="32" height="32" rx="8" fill="#534AB7"/> 
            <rect x="8" y="10" width="16" height="14" rx="2.5" fill="none" stroke="white" strokeWidth="1.5"/> 
            <line x1="8" y1="14.5" x2="24" y2="14.5" stroke="white" strokeWidth="1.5"/> 
            <line x1="12" y1="8" x2="12" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/> 
            <line x1="20" y1="8" x2="20" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/> 
            <rect x="11.5" y="17.5" width="3" height="3" rx="0.75" fill="white"/> 
            <rect x="17.5" y="17.5" width="3" height="3" rx="0.75" fill="white" opacity="0.5"/> 
          </svg> 
 
          {/* Nome fixo + label de mês */} 
          <span className="text-sm font-semibold tracking-tight text-foreground">{t("calendar.daily")}</span> 
          <span
            className="hidden max-w-[11rem] truncate text-sm font-normal capitalize text-muted-foreground sm:block md:max-w-[14rem] lg:max-w-[18rem]"
            title={calendarLabel}
          >
            {calendarLabel}
          </span>
 
          {isToday && ( 
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"> 
              {t("calendar.today")} 
            </span> 
          )} 
        </div> 

        {/* Centro: largura fixa para não “pular” quando o mês (na esquerda) muda de tamanho */}
        <div className="flex w-full max-w-[28rem] shrink-0 flex-wrap items-center justify-center justify-self-center gap-x-2 gap-y-2 sm:gap-x-3">
          {/* Navegação */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={handleToday}
              className="text-xs px-3 py-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors font-medium cursor-pointer"
            >
              {t("calendar.today")}
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
          <div className="flex flex-wrap items-center justify-center bg-secondary/30 rounded-lg p-1 gap-0.5 max-w-full">
            {VIEWS.map(({ key, labelKey }) => (
              <button
                key={key}
                onClick={() => setCurrentView(key)}
                className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-md transition-all font-medium cursor-pointer shrink-0 ${
                  currentView === key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Ações direitas */}
        <div className="flex flex-wrap items-center justify-end justify-self-end gap-2">
          <button
            onClick={openNewEvent}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">{t("calendar.newEvent")}</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/clients")}
            className="rounded-lg border border-border/30 p-1.5 text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground cursor-pointer"
            title={t("calendar.clients")}
          >
            <Users className="size-3.5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors border border-border/30 cursor-pointer">
                <UserIcon className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl mt-2">
              <DropdownMenuLabel className="font-normal py-2">
                <p className="text-xs font-medium">{t("calendar.account")}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{userEmail}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="cursor-pointer gap-2 text-sm"
              >
                {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                {theme === "dark" ? t("calendar.lightMode") : t("calendar.darkMode")}
              </DropdownMenuItem>

              <DropdownMenuItem
                className="flex w-full cursor-default flex-row items-center justify-between gap-2"
                onSelect={(e) => e.preventDefault()}
              >
                <span className="text-sm text-muted-foreground">{t("calendar.textSize")}</span>
                <div
                  className="flex items-center gap-1"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      changeFont(-1)
                    }}
                    className="flex size-7 items-center justify-center rounded-md text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground cursor-pointer"
                  >
                    A<sup className="text-[7px]">−</sup>
                  </button>
                  <span className="min-w-[2.25rem] text-center text-xs text-muted-foreground">{fontLabel}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      changeFont(1)
                    }}
                    className="flex size-7 items-center justify-center rounded-md text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground cursor-pointer"
                  >
                    A<sup className="text-[7px]">+</sup>
                  </button>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer gap-2 text-sm text-destructive focus:text-destructive focus:bg-destructive/8"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t("calendar.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CalendarWorkArea
        currentView={currentView}
        events={events}
        displayEvents={displayEvents}
        currentDate={currentDate}
        setCurrentView={setCurrentView}
        setCurrentDate={setCurrentDate}
        openEditEvent={openEditEvent}
        onToggleStatus={handleToggleStatus}
        eventPropGetter={eventPropGetter}
        calendarComponents={calendarComponents}
        calendarMessages={calendarMessages}
      />

      {/* ── Slide-over ── */}
      <EventSlideOver
        open={panelOpen}
        form={form}
        selectedEventId={selectedEventId}
        isSubmitting={isSubmitting}
        isDeleting={isDeleting}
        clients={clients}
        onClose={closePanel}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        onDelete={handleDeleteEvent}
      />
    </div>
  )
}