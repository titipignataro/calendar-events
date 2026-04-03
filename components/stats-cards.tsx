"use client"

import { Users, UserCheck, UserX, Shield } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { User } from "@/lib/user-data"

interface StatsCardsProps {
  users: User[]
}

export function StatsCards({ users }: StatsCardsProps) {
  const totalUsers = users.length
  const activeUsers = users.filter((u) => u.status === "active").length
  const inactiveUsers = users.filter((u) => u.status === "inactive").length
  const adminUsers = users.filter((u) => u.role === "admin").length

  const stats = [
    {
      label: "Total de Usuários",
      value: totalUsers,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Usuários Ativos",
      value: activeUsers,
      icon: UserCheck,
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
    },
    {
      label: "Usuários Inativos",
      value: inactiveUsers,
      icon: UserX,
      color: "text-red-400",
      bgColor: "bg-red-400/10",
    },
    {
      label: "Administradores",
      value: adminUsers,
      icon: Shield,
      color: "text-amber-400",
      bgColor: "bg-amber-400/10",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border bg-card">
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`rounded-lg p-2.5 ${stat.bgColor}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
