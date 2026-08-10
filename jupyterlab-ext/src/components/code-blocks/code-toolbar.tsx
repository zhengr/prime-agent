import { Box } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { CopyButton } from './copy-button';

const CODE_TOOLBAR_CLASS = 'jp-chat-code-toolbar';

export type CodeToolbarProps = { model: any; content: string; };

export function CodeToolbar(props: CodeToolbarProps): JSX.Element {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '2px 2px', marginBottom: '1em', border: 'none' }}
      className={CODE_TOOLBAR_CLASS}>
      <CopyButton value={props.content} className="jp-chat-code-toolbar-item" />
    </Box>
  );
}
