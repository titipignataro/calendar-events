"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (mounted) {
          if (session) {
            router.push("/calendar")
          } else {
            router.push("/login")
          }
        }
      }
    )

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        if (data.session) {
          router.push("/calendar")
        } else {
          router.push("/login")
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  return <div />
}