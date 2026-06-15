'use client'

import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Megaphone, ExternalLink } from 'lucide-react'

// Live banner for Gym Owner showing platform-wide offers (read-only)
export default function PlatformOffersBanner() {
  const [offers, setOffers] = useState([])
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'platformOffers'), where('active', '==', true)), (snap) => {
      setOffers(snap.docs.map(d => ({ ...d.data(), id: d.id })))
    }, () => {})
    return () => unsub()
  }, [])
  if (!offers.length) return null
  return (
    <div className="space-y-2 mb-6">
      {offers.map(o => (
        <Card key={o.id} className="border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50">
          <CardContent className="pt-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center shrink-0"><Megaphone className="w-5 h-5 text-orange-600" /></div>
            <div className="flex-1">
              <div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{o.title}</span><Badge variant="outline" className="text-xs bg-white">Platform Offer</Badge></div>
              <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-wrap">{o.body}</p>
              {o.ctaUrl && <a href={o.ctaUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-orange-700 font-medium mt-1 hover:underline">{o.ctaLabel || 'Learn more'} <ExternalLink className="w-3 h-3" /></a>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
