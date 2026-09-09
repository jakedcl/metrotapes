import { createContext, useContext } from 'react'

const KioskLeaveContext = createContext(null)

export function KioskLeaveProvider({ value, children }) {
  return (
    <KioskLeaveContext.Provider value={value}>
      {children}
    </KioskLeaveContext.Provider>
  )
}

/** Returns tryLeave / goHome for header + kiosk nav. */
export function useKioskLeave() {
  return useContext(KioskLeaveContext)
}
