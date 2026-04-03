export interface User {
  id: string
  name: string
  email: string
  role: "admin" | "editor" | "viewer"
  status: "active" | "inactive" | "pending"
  avatar?: string
  createdAt: string
  lastActive: string
}

export const initialUsers: User[] = [
  {
    id: "1",
    name: "Ana Silva",
    email: "ana.silva@empresa.com",
    role: "admin",
    status: "active",
    avatar: "AS",
    createdAt: "2024-01-15",
    lastActive: "2024-03-10",
  },
  {
    id: "2",
    name: "Bruno Costa",
    email: "bruno.costa@empresa.com",
    role: "editor",
    status: "active",
    avatar: "BC",
    createdAt: "2024-02-20",
    lastActive: "2024-03-09",
  },
  {
    id: "3",
    name: "Carla Mendes",
    email: "carla.mendes@empresa.com",
    role: "viewer",
    status: "inactive",
    avatar: "CM",
    createdAt: "2024-01-10",
    lastActive: "2024-02-15",
  },
  {
    id: "4",
    name: "Diego Oliveira",
    email: "diego.oliveira@empresa.com",
    role: "editor",
    status: "pending",
    avatar: "DO",
    createdAt: "2024-03-01",
    lastActive: "2024-03-01",
  },
  {
    id: "5",
    name: "Elena Ferreira",
    email: "elena.ferreira@empresa.com",
    role: "admin",
    status: "active",
    avatar: "EF",
    createdAt: "2023-11-05",
    lastActive: "2024-03-10",
  },
  {
    id: "6",
    name: "Felipe Santos",
    email: "felipe.santos@empresa.com",
    role: "viewer",
    status: "active",
    avatar: "FS",
    createdAt: "2024-02-28",
    lastActive: "2024-03-08",
  },
  {
    id: "7",
    name: "Gabriela Lima",
    email: "gabriela.lima@empresa.com",
    role: "editor",
    status: "inactive",
    avatar: "GL",
    createdAt: "2023-12-12",
    lastActive: "2024-01-20",
  },
  {
    id: "8",
    name: "Henrique Alves",
    email: "henrique.alves@empresa.com",
    role: "viewer",
    status: "pending",
    avatar: "HA",
    createdAt: "2024-03-05",
    lastActive: "2024-03-05",
  },
]

export const roleLabels: Record<User["role"], string> = {
  admin: "Administrador",
  editor: "Editor",
  viewer: "Visualizador",
}

export const statusLabels: Record<User["status"], string> = {
  active: "Ativo",
  inactive: "Inativo",
  pending: "Pendente",
}
