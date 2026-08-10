import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Box } from '@mui/material';
import React from 'react';
import { TooltippedIconButton } from '../mui-extras';

const TOOLBAR_CLASS = 'jp-chat-toolbar';

export function MessageToolbar(props: MessageToolbar.IProps): JSX.Element {
  const buttons: JSX.Element[] = [];
  if (props.edit !== undefined) {
    buttons.push(
      <TooltippedIconButton key="edit" tooltip="Edit" onClick={props.edit} inputToolbar={false}>
        <EditIcon />
      </TooltippedIconButton>
    );
  }
  if (props.delete !== undefined) {
    buttons.push(
      <TooltippedIconButton key="delete" tooltip="Delete" onClick={props.delete} inputToolbar={false}>
        <DeleteIcon />
      </TooltippedIconButton>
    );
  }
  return <Box className={TOOLBAR_CLASS} sx={{ display: 'flex', gap: 2 }}>{buttons}</Box>;
}

export namespace MessageToolbar {
  export interface IProps { edit?: () => void; delete?: () => void; }
}
