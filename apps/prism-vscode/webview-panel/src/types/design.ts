// Types for the Prism Design Studio panel view

export type DesignEngineStatus = 'stopped' | 'starting' | 'running' | 'error'

export interface DesignArtifact {
  name: string
  type: 'md' | 'pen' | 'html' | 'pdf' | 'pptx' | 'mp4' | 'zip' | 'yaml'
  path: string
  date: string
  sizeKb: number
  topic: string
}

export interface DesignEngineState {
  status: DesignEngineStatus
  port: number
  version: string
  artifacts: DesignArtifact[]
  latestDesignPrompt: string | null  // contents of the latest design_prompt.yaml from idea_init
  latestLedger: string | null        // path to the latest brainstorm ledger
  activeSession: string | null       // current design session id in the engine
  errorMessage?: string
}
