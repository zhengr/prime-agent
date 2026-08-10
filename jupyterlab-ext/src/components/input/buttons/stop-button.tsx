import StopIcon from '@mui/icons-material/Stop';
import React, { useEffect, useState } from 'react';
import { TooltippedIconButton } from '../../mui-extras';
import { IInputModel } from '../../../input-model';
import { IChatModel } from '../../../model';

interface ButtonProps {
  model: IInputModel;
  chatModel?: IChatModel;
  edit?: boolean;
}

export function StopButton(props: ButtonProps): JSX.Element {
  const { chatModel } = props;
  const [disabled, setDisabled] = useState(true);

  useEffect(() => {
    if (!chatModel) { setDisabled(true); return; }
    const checkWriters = () => { setDisabled(!chatModel.writers.some(w => w.user.bot)); };
    checkWriters();
    chatModel.writersChanged?.connect(checkWriters);
    return () => { chatModel.writersChanged?.disconnect(checkWriters); };
  }, [chatModel]);

  return (
    <TooltippedIconButton onClick={() => console.log('Stop clicked')} tooltip="Stop generating"
      disabled={disabled} buttonProps={{ className: 'jp-chat-stop-button' }}>
      <StopIcon />
    </TooltippedIconButton>
  );
}
