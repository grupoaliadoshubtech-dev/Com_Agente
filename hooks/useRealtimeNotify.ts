'use client'
import { useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
export function useRealtimeNotify(instanceName: string, onNew: (p:any)=>void) {
  useEffect(()=>{
    if(!instanceName) return;
    const supabase = createBrowserClient();
    const ch = supabase.channel(`notify-${instanceName}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'_comagente_notify',filter:`instance=eq.${instanceName}`}, (pl)=> onNew(pl.new)).subscribe()
    return ()=>{ supabase.removeChannel(ch) }
  },[instanceName, onNew])
}
