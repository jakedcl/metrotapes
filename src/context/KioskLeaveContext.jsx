import { createContext, useContext } from 'react'

const KioskLeaveContext = createContext(null)

export function KioskLeaveProvider({ value, children }) {
  return (
    <KioskLeaveContext.Provider value={value}>
      {children}
    </KioskLeaveContext.Provider>
  )
}

/** Returns true if leave was intercepted (zap will navigate after close). */
export function useKioskLeave() {
  return useContext(KioskLeaveContext)
}
