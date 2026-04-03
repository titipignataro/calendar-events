"use client"

import { useState, useMemo } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatsCards } from "@/components/stats-cards"
import { UserFilters } from "@/components/user-filters"
import { UserTable } from "@/components/user-table"
import { UserDialog } from "@/components/user-dialog"
import { DeleteDialog } from "@/components/delete-dialog"
import { initialUsers, type User } from "@/lib/user-data"

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [activeTab, setActiveTab] = useState("all")

  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (activeTab !== "all" && user.status !== activeTab) {
        return false
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (
          !user.name.toLowerCase().includes(query) &&
          !user.email.toLowerCase().includes(query)
        ) {
          return false
        }
      }

      if (roleFilter !== "all" && user.role !== roleFilter) {
        return false
      }

      if (statusFilter !== "all" && user.status !== statusFilter) {
        return false
      }

      return true
    })
  }, [users, activeTab, searchQuery, roleFilter, statusFilter])

  const handleSelectUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredUsers.map((u) => u.id))
    }
  }

  const handleCreateUser = () => {
    setEditingUser(null)
    setUserDialogOpen(true)
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setUserDialogOpen(true)
  }

  const handleDeleteUser = (user: User) => {
    setDeletingUser(user)
    setDeleteDialogOpen(true)
  }

  const handleSaveUser = (
    userData: Omit<User, "id" | "createdAt" | "lastActive" | "avatar">
  ) => {
    if (editingUser) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id ? { ...u, ...userData } : u
        )
      )
    } else {
      const newUser: User = {
        ...userData,
        id: String(Date.now()),
        avatar: userData.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2),
        createdAt: new Date().toISOString().split("T")[0],
        lastActive: new Date().toISOString().split("T")[0],
      }
      setUsers((prev) => [...prev, newUser])
    }
  }

  const handleConfirmDelete = () => {
    if (deletingUser) {
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id))
      setSelectedUsers((prev) => prev.filter((id) => id !== deletingUser.id))
      setDeletingUser(null)
    }
    setDeleteDialogOpen(false)
  }

  const handleBulkDelete = () => {
    setUsers((prev) => prev.filter((u) => !selectedUsers.includes(u.id)))
    setSelectedUsers([])
  }

  const tabCounts = {
    all: users.length,
    active: users.filter((u) => u.status === "active").length,
    inactive: users.filter((u) => u.status === "inactive").length,
    pending: users.filter((u) => u.status === "pending").length,
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Gerenciamento de Usuários
          </h1>
          <p className="mt-2 text-muted-foreground">
            Gerencie os usuários, suas funções e permissões do sistema.
          </p>
        </div>

        <div className="mb-8">
          <StatsCards users={users} />
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="border-b border-border">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-foreground">Usuários</CardTitle>
              <div className="flex gap-2">
                {selectedUsers.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir ({selectedUsers.length})
                  </Button>
                )}
                <Button size="sm" onClick={handleCreateUser}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Usuário
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="border-b border-border px-6 pt-4">
                <TabsList className="bg-secondary">
                  <TabsTrigger value="all">
                    Todos ({tabCounts.all})
                  </TabsTrigger>
                  <TabsTrigger value="active">
                    Ativos ({tabCounts.active})
                  </TabsTrigger>
                  <TabsTrigger value="inactive">
                    Inativos ({tabCounts.inactive})
                  </TabsTrigger>
                  <TabsTrigger value="pending">
                    Pendentes ({tabCounts.pending})
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <UserFilters
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    roleFilter={roleFilter}
                    onRoleChange={setRoleFilter}
                    statusFilter={statusFilter}
                    onStatusChange={setStatusFilter}
                  />
                </div>

                <TabsContent value={activeTab} className="mt-0">
                  <UserTable
                    users={filteredUsers}
                    selectedUsers={selectedUsers}
                    onSelectUser={handleSelectUser}
                    onSelectAll={handleSelectAll}
                    onEditUser={handleEditUser}
                    onDeleteUser={handleDeleteUser}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <UserDialog
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        user={editingUser}
        onSave={handleSaveUser}
      />
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        user={deletingUser}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
