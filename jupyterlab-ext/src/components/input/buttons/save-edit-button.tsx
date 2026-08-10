import CheckIcon from '@mui/icons-material/Check';
import React, { useEffect, useState } from 'react';
import { TooltippedIconButton } from '../../mui-extras';
import { IInputModel } from '../../../input-model';
import { IChatModel } from '../../../model';

interface ButtonProps {
  model: IInputModel;
  chatModel?: IChatModel;
  edit?: boolean;
}

export function SaveEditButton(props: ButtonProps): JSX.Element {
  const { model } = props;
  const [disabled, setDisabled] = useState(false);

  if (!props.edit) return <></>;

  useEffect(() => {
    const inputChanged = () => { setDisabled(!model.value.trim()); };
    model.valueChanged.connect(inputChanged);
    inputChanged();
    return () => { model.valueChanged.disconnect(inputChanged); };
  }, [model]);

  async function save() {
    model.send(model.value);
    model.value = '';
    model.focus();
  }

  return (
    <TooltippedIconButton onClick={save} tooltip="Save edits" disabled={disabled}
      buttonProps={{ className: 'jp-chat-save-edit-button' }}>
      <CheckIcon />
    </TooltippedIconButton>
  );
}
