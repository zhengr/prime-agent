import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import Box from '@mui/material/Box';
import React, { useEffect, useMemo, useState } from 'react';
import { ChatInput } from './input';
import { JlThemeProvider } from './jl-theme-provider';
import { ChatMessages } from './messages';
import { WritingIndicator } from './writing-indicator';
import { ChatReactContext, IChatContextValue } from '../context';
import { IChatModel } from '../model';
import { ChatArea } from '../types';

export function ChatBody(props: Chat.IChatProps): JSX.Element {
  const { model } = props;
  const [writers, setWriters] = useState<IChatModel.IWriter[]>([]);

  useEffect(() => {
    if (!model) return;
    const updateWriters = (_: IChatModel, writers: IChatModel.IWriter[]) => setWriters(writers);
    setWriters(model.writers);
    model.writersChanged?.connect(updateWriters);
    return () => { model?.writersChanged?.disconnect(updateWriters); };
  }, [model]);

  const contextValue: IChatContextValue = useMemo(() => ({
    model: props.model, rmRegistry: props.rmRegistry, area: props.area
  }), [props]);

  return (
    <ChatReactContext.Provider value={contextValue}>
      <ChatMessages />
      <ChatInput sx={{ paddingLeft: 4, paddingRight: 4, paddingTop: 0, paddingBottom: 0 }} model={model.input} />
      <WritingIndicator sx={{ paddingLeft: 4, paddingRight: 4 }} writers={writers} />
    </ChatReactContext.Provider>
  );
}

export function Chat(props: Chat.IOptions): JSX.Element {
  return (
    <JlThemeProvider themeManager={props.themeManager ?? null}>
      <Box className="jp-ThemedContainer"
        sx={{ width: '100%', height: '100%', boxSizing: 'border-box', background: 'var(--jp-layout-color0)', display: 'flex', flexDirection: 'column' }}>
        <ChatBody {...props} />
      </Box>
    </JlThemeProvider>
  );
}

export namespace Chat {
  export interface IChatProps {
    model: IChatModel;
    rmRegistry: IRenderMimeRegistry;
    area?: ChatArea;
    welcomeMessage?: string;
  }
  export interface IOptions extends IChatProps {
    themeManager?: any | null;
  }
}
