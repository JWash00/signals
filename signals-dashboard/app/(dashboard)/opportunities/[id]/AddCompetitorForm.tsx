'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addCompetitor } from '../actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function AddCompetitorForm({ opportunityId }: { opportunityId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    setError(null)
    setLoading(true)
    formData.set('opportunity_id', opportunityId)
    try {
      await addCompetitor(formData)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add competitor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input id="name" name="name" label="Name" required placeholder="Competitor name" />
      </div>
      <div className="sm:w-48">
        <Input id="url" name="url" label="URL" placeholder="https://..." />
      </div>
      <div className="sm:w-48">
        <Input id="notes" name="notes" label="Notes" placeholder="Optional notes" />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Adding...' : 'Add'}
      </Button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  )
}
