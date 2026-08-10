import { Autocomplete, Box, SxProps, TextField, Theme } from '@mui/material';
import clsx from 'clsx';
import React, { useEffect, useRef, useState } from 'react';
import { SendButton } from './buttons/send-button';
import { StopButton } from './buttons/stop-button';
import { submitInputMessage } from './submit-message';
import { useChatCommands } from './use-chat-commands';
import { AttachmentPreviewList } from '../attachments';
import { useChatContext } from '../../context';
import { IInputModel } from '../../input-model';
import { IAttachment } from '../../types';

const INPUT_BOX_CLASS = 'jp-chat-input-container';
const INPUT_TEXTFIELD_CLASS = 'jp-chat-input-textfield';

export function ChatInput(props: ChatInput.IProps): JSX.Element {
  const { model } = props;
  const { area, model: chatModel } = useChatContext();
  const [input, setInput] = useState<string>(model.value);
  const inputRef = useRef<HTMLInputElement>();
  const chatCommands = useChatCommands(model);
  const [sendWithShiftEnter, setSendWithShiftEnter] = useState(model.config.sendWithShiftEnter ?? false);
  const [attachments, setAttachments] = useState<IAttachment[]>(model.attachments);

  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

  useEffect(() => {
    const inputChanged = (_: IInputModel, value: string) => setInput(value);
    model.valueChanged.connect(inputChanged);
    const configChanged = (_: IInputModel, config: any) => setSendWithShiftEnter(config.sendWithShiftEnter ?? false);
    model.configChanged.connect(configChanged);
    const focusInputElement = () => { if (inputRef.current) inputRef.current.focus(); };
    model.focusInputSignal?.connect(focusInputElement);
    const attachmentChanged = (_: IInputModel, atts: IAttachment[]) => setAttachments([...atts]);
    model.attachmentsChanged?.connect(attachmentChanged);
    return () => {
      model.valueChanged.disconnect(inputChanged);
      model.configChanged.disconnect(configChanged);
      model.focusInputSignal?.disconnect(focusInputElement);
      model.attachmentsChanged?.disconnect(attachmentChanged);
    };
  }, [model]);

  const inputExists = !!input.trim();

  async function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (['ArrowDown', 'ArrowUp'].includes(event.key) && !chatCommands.menu.open) { event.stopPropagation(); return; }
    if (event.key !== 'Enter') return;
    if (chatCommands.menu.open) return;
    event.stopPropagation();
    const isSendCombination = (sendWithShiftEnter && event.shiftKey) || (!sendWithShiftEnter && !event.shiftKey);
    if (!inputExists && (!isSendCombination || attachments.length === 0)) { event.preventDefault(); return; }
    if (isSendCombination) { await submitInputMessage({ model }); event.preventDefault(); }
  }

  const horizontalPadding = area === 'sidebar' ? 1.5 : 2;

  const toolbarProps = { model, chatModel, edit: props.edit };

  return (
    <Box sx={props.sx} className={clsx(INPUT_BOX_CLASS)} data-input-id={model.id}>
      <Box sx={{ border: '1px solid', borderColor: 'var(--jp-border-color1)', borderRadius: 2, transition: 'border-color 0.2s ease', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {attachments.length > 0 && (
          <Box sx={{ px: horizontalPadding, pt: 1, pb: 1 }}>
            <AttachmentPreviewList attachments={attachments} onRemove={model.removeAttachment} />
          </Box>
        )}
        <Autocomplete
          {...chatCommands.autocompleteProps}
          renderInput={params => (
            <TextField {...params} fullWidth variant="standard" className={INPUT_TEXTFIELD_CLASS} multiline maxRows={10}
              onKeyDown={handleKeyDown} placeholder="Type a message..." inputRef={inputRef}
              onSelect={() => (model.cursorIndex = inputRef.current?.selectionStart ?? null)}
              sx={{ padding: 1.5, margin: 0, boxSizing: 'border-box', backgroundColor: 'var(--jp-layout-color0)',
                '& .MuiInputBase-root': { padding: 0, margin: 0, '&:before': { display: 'none' }, '&:after': { display: 'none' } },
                '& .MuiInputBase-input': { overflowWrap: 'break-word', wordBreak: 'break-word' }
              }}
              InputProps={{ ...params.InputProps, disableUnderline: true }}
              FormHelperTextProps={{ sx: { display: 'none' } }}
            />
          )}
          inputValue={input}
          onInputChange={(_, newValue: string, reason: string) => {
            if (reason === 'selectOption' || reason === 'reset' || reason === 'blur') return;
            model.value = newValue;
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, padding: 1, borderTop: '1px solid', borderColor: 'var(--jp-border-color1)', backgroundColor: 'var(--jp-layout-color0)' }}>
          {props.edit && <StopButton {...toolbarProps} />}
          <SendButton {...toolbarProps} />
        </Box>
      </Box>
    </Box>
  );
}

export namespace ChatInput {
  export interface IProps { model: IInputModel; onCancel?: () => unknown; sx?: SxProps<Theme>; edit?: boolean; }
}
