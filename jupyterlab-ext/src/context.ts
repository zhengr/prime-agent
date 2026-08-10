import React, { createContext, useContext } from 'react';
import { IChatModel } from './model';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { ChatArea } from './types';

export interface IChatContextValue {
  model: IChatModel;
  rmRegistry: IRenderMimeRegistry;
  area?: ChatArea;
}

export const ChatReactContext = createContext<IChatContextValue | undefined>(undefined);

export function useChatContext(): IChatContextValue {
  const context = useContext(ChatReactContext);
  if (!context) {
    throw new Error('Chat context is missing');
  }
  return context;
}
