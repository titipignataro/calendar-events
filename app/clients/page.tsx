"use client"

import { useEffect, useState, useCallback, useMemo, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { ArrowUpDown, ArrowUp, ArrowDown, Plus, ChevronLeft, Trash2, Pencil, Search, Calendar as CalendarIcon, User as UserIcon, LogOut, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import "@/lib/i18n"
import { useTranslation } from "react-i18next"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar as CalendarUI } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─── Types ────────────────────────────────────────────────────────────────────

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

const EMPTY_CLIENT_FORM = { 
  name: "", 
  process_number: "", 
  area: "", 
  date: "", 
  email: "", 
  phone: "", 
  notes: "" 
}

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

// ─── Page ──────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const router = useRouter()
  const { t } = useTranslation()
  
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState("")
  
  // Lista unificada e Sorting
  const [clients, setClients] = useState<ClientRow[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [sortCol, setSortCol] = useState<keyof ClientRow>("name")
  const [sortDesc, setSortDesc] = useState(false)

  // Drawer options
  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_CLIENT_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { theme, setTheme } = useTheme()

  // ── Fetch ───────────────────────────────────────────────────────

  const loadClients = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push("/login")
        return
      }
      setUserEmail(session.user.email ?? "")
      
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", session.user.id)

      if (error) throw error
      setClients((data as ClientRow[]) ?? [])
    } catch {
      toast.error("Erro ao carregar clientes. Rode as migrations SQL.")
    } finally {
      setLoading(false)
    }
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
        await loadClients()
      }
    }
    
    init()
    
    return () => {
      mounted = false
    }
  }, [loadClients, router])

  // ── Handlers ────────────────────────────────────────────────────────

  const toggleSort = (col: keyof ClientRow) => {
    if (sortCol === col) {
      setSortDesc(!sortDesc)
    } else {
      setSortCol(col)
      setSortDesc(false)
    }
  }

  const handleCreate = () => {
    setEditingId(null)
    setForm(EMPTY_CLIENT_FORM)
    setSheetOpen(true)
  }

  const handleEdit = (c: ClientRow) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      process_number: c.process_number ?? "",
      area: c.area ?? "",
      date: c.date ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      notes: c.notes ?? "",
    })
    setSheetOpen(true)
  }

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!confirm(t("calendar.deleteClientConfirm") as string)) return
    try {
      const { error } = await supabase.from("clients").delete().eq("id", id)
      if (error) throw error
      toast.success(t("calendar.clientDeleted"))
      setClients(prev => prev.filter(c => c.id !== id))
      if (editingId === id) setSheetOpen(false)
    } catch {
      toast.error("Erro ao excluir cliente")
    }
  }

  const handleSubmit = async (e: FormEvent) => {
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
        process_number: form.process_number.trim() || null,
        area: form.area.trim() || null,
        date: form.date || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        user_id: session.user.id
      }

      if (editingId) {
        const { error } = await supabase
          .from("clients")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingId)
        if (error) throw error
        toast.success(t("calendar.clientUpdated"))
      } else {
        const { error } = await supabase
          .from("clients")
          .insert(payload)
        if (error) throw error
        toast.success(t("calendar.clientCreated"))
      }
      
      setSheetOpen(false)
      await loadClients()
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar cliente")
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  // ── Render Prepare ──────────────────────────────────────────────────

  const displayClients = useMemo(() => {
    let result = [...clients]
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      result = result.filter(c => 
        c.name.toLowerCase().includes(q) ||
        (c.process_number && c.process_number.toLowerCase().includes(q)) ||
        (c.area && c.area.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      )
    }
    
    result.sort((a, b) => {
      const valA = a[sortCol] ?? ""
      const valB = b[sortCol] ?? ""
      if (valA < valB) return sortDesc ? 1 : -1
      if (valA > valB) return sortDesc ? -1 : 1
      return 0
    })

    return result
  }, [clients, searchTerm, sortCol, sortDesc])

  if (loading) return <Spinner />

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden relative">
      <header className="flex-none grid grid-cols-[auto_1fr_auto] items-center px-4 py-3 border-b border-border/40 bg-background/80 backdrop-blur-md">
        
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/calendar")} title="Voltar ao calendário" className="w-8 h-8 rounded-lg cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-foreground">{t("calendar.clients")}</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{displayClients.length} {(displayClients.length === 1 ? t("calendar.clientsCount_one") : t("calendar.clientsCount_other")).split(" ")[1]}</span>
          </div>
        </div>

        <div className="flex-1 flex justify-center px-4 max-w-sm mx-auto w-full">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, processo, área..."
              className="pl-9 h-9 bg-secondary/30 border-border/40 text-sm focus-visible:ring-1"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button onClick={handleCreate} size="sm" className="h-9 gap-1.5 cursor-pointer">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline-block">{t("calendar.newClient")}</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 py-2.5 px-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors border border-border/30 cursor-pointer">
                <UserIcon className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl mt-2">
              <DropdownMenuLabel className="font-normal py-2">
                <p className="text-xs font-medium">{t("calendar.account")}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{userEmail}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="cursor-pointer gap-2 text-sm">
                {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                {theme === "dark" ? t("calendar.lightMode") : t("calendar.darkMode")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer gap-2 text-sm text-destructive focus:bg-destructive/10">
                <LogOut className="w-3.5 h-3.5" />
                {t("calendar.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 pb-20">
        <div className="bg-background rounded-xl border border-border/40 shadow-sm overflow-hidden h-full flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-secondary/30 text-muted-foreground border-b border-border/40 sticky top-0 z-10">
                <tr>
                  {[
                    { key: "name", label: t("calendar.name") },
                    { key: "process_number", label: t("calendar.processNumber") },
                    { key: "area", label: t("calendar.area") },
                    { key: "date", label: t("calendar.clientDate") }
                  ].map(col => (
                    <th 
                      key={col.key} 
                      className="px-4 py-3 font-medium cursor-pointer hover:bg-secondary/50 transition-colors whitespace-nowrap select-none"
                      onClick={() => toggleSort(col.key as keyof ClientRow)}
                    >
                      <div className="flex items-center gap-1.5">
                        {col.label}
                        {sortCol === col.key ? (
                          sortDesc ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {displayClients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  displayClients.map(client => (
                    <tr 
                      key={client.id} 
                      className="hover:bg-secondary/10 transition-colors cursor-pointer group"
                      onClick={() => handleEdit(client)}
                    >
                      <td className="px-4 py-3.5 font-medium whitespace-nowrap">
                        {client.name}
                        {client.email && <span className="block text-[10px] text-muted-foreground font-normal mt-0.5">{client.email}</span>}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap min-w-[120px]">
                        {client.process_number || <span className="opacity-40">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {client.area ? (
                          <span className="inline-block px-2 py-0.5 bg-secondary/50 rounded text-xs">
                            {client.area}
                          </span>
                        ) : <span className="opacity-40">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                        {client.date ? new Date(client.date).toLocaleDateString() : <span className="opacity-40">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleDelete(client.id, e)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg z-[60] bg-background">
          <SheetHeader className="space-y-1 border-b border-border/40 p-5 text-left bg-secondary/5">
            <SheetTitle className="text-lg">
              {editingId ? t("calendar.editingClient") : t("calendar.newClient")}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {t("calendar.clientsDescription")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <form id="client-form" onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
              
              <div className="space-y-1.5">
                <Label htmlFor="c-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("calendar.name")}</Label>
                <Input 
                  id="c-name" 
                  value={form.name} 
                  onChange={e => setForm(f => ({...f, name: e.target.value}))} 
                  required 
                  className="bg-secondary/20" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="c-process" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("calendar.processNumber")}</Label>
                  <Input 
                    id="c-process" 
                    value={form.process_number} 
                    onChange={e => setForm(f => ({...f, process_number: e.target.value}))} 
                    className="bg-secondary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-area" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("calendar.area")}</Label>
                  <Select
                    value={form.area || undefined}
                    onValueChange={(val) => setForm(f => ({ ...f, area: val }))}
                  >
                    <SelectTrigger id="c-area" className="bg-secondary/20 h-9 w-full cursor-pointer">
                      <SelectValue placeholder="Selecione a área..." />
                    </SelectTrigger>
                    <SelectContent className="z-[70]">
                      <SelectItem value="Direito Trabalhista">Direito Trabalhista</SelectItem>
                      <SelectItem value="Direito Civil">Direito Civil</SelectItem>
                      <SelectItem value="Direito Criminal">Direito Criminal</SelectItem>
                      <SelectItem value="Direito Tributário">Direito Tributário</SelectItem>
                      <SelectItem value="Direito Previdenciário">Direito Previdenciário</SelectItem>
                      <SelectItem value="Direito Empresarial">Direito Empresarial</SelectItem>
                      <SelectItem value="Direito de Família">Direito de Família</SelectItem>
                      <SelectItem value="Direito Administrativo">Direito Administrativo</SelectItem>
                      <SelectItem value="Outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="c-date" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-[2px]">{t("calendar.clientDate")}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 bg-secondary/20 border-border/40 hover:bg-secondary/30 focus:ring-0 rounded-md cursor-pointer justify-start text-left font-normal",
                        !form.date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {form.date ? (() => {
                        const [y, m, d] = form.date.split("-")
                        return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString()
                      })() : <span>{t("calendar.selectDate") || "Selecionar data"}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[70]" align="start">
                    <CalendarUI
                      mode="single"
                      selected={form.date ? (() => {
                        const [y, m, d] = form.date.split("-")
                        return new Date(Number(y), Number(m) - 1, Number(d))
                      })() : undefined}
                      onSelect={(date) => {
                        if (!date) return
                        const pad = (n: number) => n.toString().padStart(2, '0')
                        setForm(f => ({ ...f, date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }))
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="w-full h-px bg-border/40 my-2" />
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 mb-1">Contato</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="c-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("calendar.email")}</Label>
                  <Input 
                    id="c-email" 
                    type="email" 
                    value={form.email} 
                    onChange={e => setForm(f => ({...f, email: e.target.value}))} 
                    className="bg-secondary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("calendar.phone")}</Label>
                  <Input 
                    id="c-phone" 
                    value={form.phone} 
                    onChange={e => setForm(f => ({...f, phone: e.target.value}))} 
                    className="bg-secondary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5 mt-2">
                <Label htmlFor="c-notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("calendar.notes")}</Label>
                <Textarea 
                  id="c-notes" 
                  value={form.notes} 
                  onChange={e => setForm(f => ({...f, notes: e.target.value}))} 
                  rows={3} 
                  className="bg-secondary/20 resize-y"
                />
              </div>
            </form>
          </div>

          <div className="p-5 border-t border-border/40 bg-secondary/5 flex flex-col gap-2">
            <Button type="submit" form="client-form" disabled={saving} className="w-full font-medium">
              {saving ? t("calendar.saving") : editingId ? t("calendar.saveChanges") : t("calendar.addClient")}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={() => handleDelete(editingId)} className="w-full text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="w-4 h-4 mr-1.5" />
                {t("calendar.deleteClientConfirm")}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

    </div>
  )
}
