import React, { createContext, useContext, useState } from 'react';

interface MenuContextType {
  isMenuVisible: boolean;
  setIsMenuVisible: (visible: boolean) => void;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

export const MenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  return (
    <MenuContext.Provider value={{ isMenuVisible, setIsMenuVisible }}>
      {children}
    </MenuContext.Provider>
  );
};

export const useMenu = () => {
  const context = useContext(MenuContext);
  if (context === undefined) {
    throw new Error('useMenu must be used within a MenuProvider');
  }
  return context;
}; 