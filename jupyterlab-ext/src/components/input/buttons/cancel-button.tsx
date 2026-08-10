import CloseIcon from '@mui/icons-material/Close';
import React from 'react';
import { TooltippedIconButton } from '../../mui-extras';
import { IInputModel } from '../../../input-model';
import { IChatModel } from '../../../model';

interface ButtonProps {
  model: IInputModel;
  chatModel?: IChatModel;
  edit?: boolean;
}

export function CancelButton(props: ButtonProps): JSX.Element {
  if (!props.model.cancel) return <></>;
  return (
    <TooltippedIconButton onClick={props.model.cancel} tooltip="Cancel editing"
      buttonProps={{ className: 'jp-chat-cancel-button' }}>
      <CloseIcon />
    </TooltippedIconButton>
  );
}
