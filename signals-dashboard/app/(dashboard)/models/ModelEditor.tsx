'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateModel } from './actions'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'

interface ModelEditorProps {
  modelId: string
  weights: unknown
  thresholds: unknown
  penalties: unknown
}

export function ModelEditor({ modelId, weights, thresholds, penalties }: ModelEditorProps) {
  const [weightsJson, setWeightsJson] = useState(JSON.stringify(weights, null, 2))
  const [thresholdsJson, setThresholdsJson] = useState(JSON.stringify(thresholds, null, 2))
  const [penaltiesJson, setPenaltiesJson] = useState(JSON.stringify(penalties, null, 2))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    setError(null)
    setLoading(true)
    formData.set('model_id', modelId)
    formData.set('weights', weightsJson)
    formData.set('thresholds', thresholdsJson)
    formData.set('penalties', penaltiesJson)
    try {
      await updateModel(formData)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <Textarea
        id={`weights-${modelId}`}
        label="Weights (must sum to 1.0)"
        value={weightsJson}
        onChange={(e) => setWeightsJson(e.target.value)}
        rows={6}
      />
      <Textarea
        id={`thresholds-${modelId}`}
        label="Thresholds"
        value={thresholdsJson}
        onChange={(e) => setThresholdsJson(e.target.value)}
        rows={5}
      />
      <Textarea
        id={`penalties-${modelId}`}
        label="Penalties"
        value={penaltiesJson}
        onChange={(e) => setPenaltiesJson(e.target.value)}
        rows={3}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Update Model'}
      </Button>
    </form>
  )
}
