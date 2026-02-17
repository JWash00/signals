'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { runAnalysis } from '../../runs/actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const fields = [
  { name: 'demand_strength', label: 'Demand Strength' },
  { name: 'pain_intensity', label: 'Pain Intensity' },
  { name: 'willingness_to_pay', label: 'Willingness to Pay' },
  { name: 'competitive_headroom', label: 'Competitive Headroom' },
  { name: 'saturation', label: 'Saturation' },
  { name: 'timing', label: 'Timing' },
] as const

export function RunAnalysisForm({ opportunityId }: { opportunityId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    setError(null)
    setLoading(true)
    formData.set('opportunity_id', opportunityId)
    try {
      await runAnalysis(formData)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-500">
        Enter values between 0 and 1 for each dimension.
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {fields.map((f) => (
          <Input
            key={f.name}
            id={f.name}
            name={f.name}
            label={f.label}
            type="number"
            min="0"
            max="1"
            step="0.01"
            required
            placeholder="0.0 — 1.0"
          />
        ))}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Running...' : 'Run Analysis'}
      </Button>
    </form>
  )
}
