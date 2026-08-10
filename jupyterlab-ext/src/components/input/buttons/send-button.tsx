import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import React, { useEffect, useState } from 'react';
import { TooltippedIconButton } from '../../mui-extras';
import { IInputModel } from '../../../input-model';
import { IChatModel } from '../../../model';

const SEND_BUTTON_CLASS = 'jp-chat-send-button';

interface ButtonProps {
  model: IInputModel;
  chatModel?: IChatModel;
  edit?: boolean;
}

export function SendButton(props: ButtonProps): JSX.Element {
  const { model } = props;
  const [disabled, setDisabled] = useState(true);
  const [tooltip, setTooltip] = useState('Send message');

  useEffect(() => {
    const inputChanged = () => { setDisabled(!model.value.trim()); };
    model.valueChanged.connect(inputChanged);
    const configChanged = () => {
      setTooltip(model.config.sendWithShiftEnter ? 'Send (SHIFT+ENTER)' : 'Send (ENTER)');
    };
    model.configChanged.connect(configChanged);
    configChanged();
    inputChanged();
    return () => { model.valueChanged.disconnect(inputChanged); model.configChanged.disconnect(configChanged); };
  }, [model]);

  async function send() {
    model.send(model.value);
    model.value = '';
    model.focus();
  }

  return (
    <TooltippedIconButton onClick={send} tooltip={tooltip} disabled={disabled}
      buttonProps={{ title: tooltip, className: SEND_BUTTON_CLASS }} aria-label={tooltip}>
      <ArrowUpwardIcon />
    </TooltippedIconButton>
  );
}
