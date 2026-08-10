import AttachFileIcon from '@mui/icons-material/AttachFile';
import React from 'react';
import { TooltippedIconButton } from '../../mui-extras';
import { IInputModel } from '../../../input-model';
import { IChatModel } from '../../../model';

interface ButtonProps {
  model: IInputModel;
  chatModel?: IChatModel;
  edit?: boolean;
}

export function AttachButton(props: ButtonProps): JSX.Element {
  const { model } = props;
  if (!model.addAttachment) return <></>;
  return (
    <TooltippedIconButton onClick={() => {}} tooltip="Add attachment"
      buttonProps={{ className: 'jp-chat-attach-button' }}>
      <AttachFileIcon />
    </TooltippedIconButton>
  );
}
