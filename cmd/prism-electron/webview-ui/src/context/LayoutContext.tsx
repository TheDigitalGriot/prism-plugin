import React, { createContext, useContext, useReducer } from "react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LeftPanel = "files" | "stories" | "git"
export type RightPanel = "monitor" | "spectrum" | "workspace"
export type TabType = "chat" | "story" | "file" | "git"
export type BottomTab = "office" | "terminal"

export interface Tab {
  id: string // "chat", "story:STORY-001", "file:App.tsx", "git:graph"
  type: TabType
  label: string
  pinned: boolean // Chat tab always pinned
}

export interface LayoutState {
  leftPanel: LeftPanel
  rightPanel: RightPanel
  leftCollapsed: boolean
  rightCollapsed: boolean
  tabs: Tab[]
  activeTabId: string
  bottomOpen: boolean
  bottomTab: BottomTab
}

export interface LayoutActions {
  setLeftPanel: (panel: LeftPanel) => void
  setRightPanel: (panel: RightPanel) => void
  toggleLeftCollapsed: () => void
  toggleRightCollapsed: () => void
  openTab: (tab: Omit<Tab, "pinned"> & { pinned?: boolean }) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  toggleBottom: () => void
  setBottomTab: (tab: BottomTab) => void
}

type LayoutContextValue = LayoutState & LayoutActions

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

const DEFAULT_STATE: LayoutState = {
  leftPanel: "stories",
  rightPanel: "monitor",
  leftCollapsed: false,
  rightCollapsed: true,
  tabs: [{ id: "chat", type: "chat", label: "Chat", pinned: true }],
  activeTabId: "chat",
  bottomOpen: false,
  bottomTab: "office",
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type LayoutAction =
  | { type: "SET_LEFT_PANEL"; panel: LeftPanel }
  | { type: "SET_RIGHT_PANEL"; panel: RightPanel }
  | { type: "TOGGLE_LEFT_COLLAPSED" }
  | { type: "TOGGLE_RIGHT_COLLAPSED" }
  | { type: "OPEN_TAB"; tab: Tab }
  | { type: "CLOSE_TAB"; tabId: string }
  | { type: "SET_ACTIVE_TAB"; tabId: string }
  | { type: "TOGGLE_BOTTOM" }
  | { type: "SET_BOTTOM_TAB"; tab: BottomTab }

function layoutReducer(state: LayoutState, action: LayoutAction): LayoutState {
  switch (action.type) {
    case "SET_LEFT_PANEL": {
      const isCurrentPanel = action.panel === state.leftPanel
      if (isCurrentPanel && !state.leftCollapsed) {
        // Clicking active panel icon collapses the rail
        return { ...state, leftCollapsed: true }
      }
      // Clicking a different panel (or clicking while collapsed) opens it
      return { ...state, leftPanel: action.panel, leftCollapsed: false }
    }

    case "SET_RIGHT_PANEL": {
      const isCurrentPanel = action.panel === state.rightPanel
      if (isCurrentPanel && !state.rightCollapsed) {
        return { ...state, rightCollapsed: true }
      }
      return { ...state, rightPanel: action.panel, rightCollapsed: false }
    }

    case "TOGGLE_LEFT_COLLAPSED":
      return { ...state, leftCollapsed: !state.leftCollapsed }

    case "TOGGLE_RIGHT_COLLAPSED":
      return { ...state, rightCollapsed: !state.rightCollapsed }

    case "OPEN_TAB": {
      const existing = state.tabs.find((t) => t.id === action.tab.id)
      if (existing) {
        // Tab already open — just activate it
        return { ...state, activeTabId: action.tab.id }
      }
      return {
        ...state,
        tabs: [...state.tabs, action.tab],
        activeTabId: action.tab.id,
      }
    }

    case "CLOSE_TAB": {
      const tab = state.tabs.find((t) => t.id === action.tabId)
      if (!tab || tab.pinned) return state // Cannot close pinned tabs

      const newTabs = state.tabs.filter((t) => t.id !== action.tabId)
      let newActiveId = state.activeTabId

      if (state.activeTabId === action.tabId) {
        // Activate previous tab, or fallback to chat
        const closedIdx = state.tabs.findIndex((t) => t.id === action.tabId)
        const prevTab = state.tabs[closedIdx - 1]
        newActiveId = prevTab ? prevTab.id : "chat"
      }

      return { ...state, tabs: newTabs, activeTabId: newActiveId }
    }

    case "SET_ACTIVE_TAB":
      return { ...state, activeTabId: action.tabId }

    case "TOGGLE_BOTTOM":
      return { ...state, bottomOpen: !state.bottomOpen }

    case "SET_BOTTOM_TAB":
      return { ...state, bottomTab: action.tab }

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

const LayoutContext = createContext<LayoutContextValue | null>(null)

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(layoutReducer, DEFAULT_STATE)

  const actions: LayoutActions = {
    setLeftPanel: (panel) => dispatch({ type: "SET_LEFT_PANEL", panel }),
    setRightPanel: (panel) => dispatch({ type: "SET_RIGHT_PANEL", panel }),
    toggleLeftCollapsed: () => dispatch({ type: "TOGGLE_LEFT_COLLAPSED" }),
    toggleRightCollapsed: () => dispatch({ type: "TOGGLE_RIGHT_COLLAPSED" }),
    openTab: (tab) =>
      dispatch({ type: "OPEN_TAB", tab: { pinned: false, ...tab } }),
    closeTab: (tabId) => dispatch({ type: "CLOSE_TAB", tabId }),
    setActiveTab: (tabId) => dispatch({ type: "SET_ACTIVE_TAB", tabId }),
    toggleBottom: () => dispatch({ type: "TOGGLE_BOTTOM" }),
    setBottomTab: (tab) => dispatch({ type: "SET_BOTTOM_TAB", tab }),
  }

  return (
    <LayoutContext.Provider value={{ ...state, ...actions }}>
      {children}
    </LayoutContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error("useLayout must be used within a LayoutProvider")
  return ctx
}
