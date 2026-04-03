"use client"

import { MoreHorizontal, Pencil, Trash2, Key } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { User } from "@/lib/user-data"
import { roleLabels, statusLabels } from "@/lib/user-data"

interface UserTableProps {
  users: User[]
  selectedUsers: string[]
  onSelectUser: (userId: string) => void
  onSelectAll: () => void
  onEditUser: (user: User) => void
  onDeleteUser: (user: User) => void
}

const statusStyles: Record<User["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  inactive: "bg-red-500/15 text-red-400 border-red-500/20",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/20",
}

const roleStyles: Record<User["role"], string> = {
  admin: "bg-primary/15 text-primary border-primary/20",
  editor: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  viewer: "bg-slate-500/15 text-slate-400 border-slate-500/20",
}

export function UserTable({
  users,
  selectedUsers,
  onSelectUser,
  onSelectAll,
  onEditUser,
  onDeleteUser,
}: UserTableProps) {
  const allSelected = users.length > 0 && selectedUsers.length === users.length

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onSelectAll}
                aria-label="Selecionar todos"
              />
            </TableHead>
            <TableHead className="text-muted-foreground">Usuário</TableHead>
            <TableHead className="text-muted-foreground">Função</TableHead>
            <TableHead className="text-muted-foreground">Status</TableHead>
            <TableHead className="text-muted-foreground hidden md:table-cell">
              Última atividade
            </TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                Nenhum usuário encontrado.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow
                key={user.id}
                className="border-border hover:bg-secondary/50"
              >
                <TableCell>
                  <Checkbox
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={() => onSelectUser(user.id)}
                    aria-label={`Selecionar ${user.name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarFallback className="bg-secondary text-foreground text-sm">
                        {user.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={roleStyles[user.role]}>
                    {roleLabels[user.role]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusStyles[user.status]}>
                    {statusLabels[user.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {new Date(user.lastActive).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Abrir menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => onEditUser(user)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Key className="mr-2 h-4 w-4" />
                        Permissões
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-400 focus:text-red-400"
                        onClick={() => onDeleteUser(user)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
