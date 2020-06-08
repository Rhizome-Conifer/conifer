import { createContext } from 'react';

export const AccessContext = createContext({
  canAdmin: false
});

export const AppContext = createContext({
  isAnon: false,
  isEmbed: false,
  isMobile: false
});
