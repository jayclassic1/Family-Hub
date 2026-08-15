import { createContext, useContext, useState } from "react";

const TopBarActionsContext = createContext(null);

// Lets an individual page inject a small action (e.g. an "Edit Profile"
// button) into the shared TopBar, without TopBar needing to know about
// individual pages.
export function TopBarActionsProvider({ children }) {
  const [action, setAction] = useState(null);
  return (
    <TopBarActionsContext.Provider value={{ action, setAction }}>
      {children}
    </TopBarActionsContext.Provider>
  );
}

export function useTopBarActions() {
  return useContext(TopBarActionsContext);
}
