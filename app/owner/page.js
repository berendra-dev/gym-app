'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import GymOwnerPage from '../gym-owner/page'

export default function OwnerPage() {
  // Alias route: renders the gym owner dashboard at /owner (canonical path)
  return <GymOwnerPage />
}
