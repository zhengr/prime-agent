import type { AutocompleteChangeReason, AutocompleteProps as GenericAutocompleteProps } from '@mui/material';
import { Box, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { ChatCommand, IChatCommandRegistry } from '../../registers';
import { IInputModel } from '../../input-model';

type AutocompleteProps = GenericAutocompleteProps<any, any, any, any>;

type UseChatCommandsReturn = {
  autocompleteProps: Omit<AutocompleteProps, 'renderInput'>;
  menu: { open: boolean; highlighted: boolean; };
};

export function useChatCommands(inputModel: IInputModel, chatCommandRegistry?: IChatCommandRegistry): UseChatCommandsReturn {
  const [highlighted, setHighlighted] = useState(false);
  const [open, setOpen] = useState(false);
  const [commands, setCommands] = useState<ChatCommand[]>([]);

  useEffect(() => {
    async function getCommands(_: IInputModel, currentWord: string | null) {
      const providers = chatCommandRegistry?.getProviders();
      if (!providers) return;
      if (!currentWord?.length) { setCommands([]); setOpen(false); setHighlighted(false); return; }
      let commandCompletions: ChatCommand[] = [];
      for (const provider of providers) {
        try { commandCompletions = commandCompletions.concat(await provider.listCommandCompletions(inputModel)); }
        catch (e) { console.error('Error getting commands:', e); }
      }
      if (commandCompletions.length === 1 && commandCompletions[0].name === inputModel.currentWord && commandCompletions[0].replaceWith !== undefined) {
        inputModel.replaceCurrentWord(commandCompletions[0].replaceWith);
        return;
      }
      if (commandCompletions.length) setOpen(true);
      else { setOpen(false); setHighlighted(false); }
      setCommands(commandCompletions);
    }
    inputModel.currentWordChanged.connect(getCommands);
    return () => { inputModel.currentWordChanged.disconnect(getCommands); };
  }, [inputModel]);

  const onChange: AutocompleteProps['onChange'] = (e, command: ChatCommand, reason: AutocompleteChangeReason) => {
    if (reason !== 'selectOption' || !chatCommandRegistry) return;
    const currentWord = inputModel.currentWord;
    if (!currentWord) return;
    let replacement = command.replaceWith === undefined ? command.name : command.replaceWith;
    if (command.spaceOnAccept) replacement += ' ';
    inputModel.replaceCurrentWord(replacement);
  };

  return {
    autocompleteProps: {
      open, options: commands, getOptionLabel: (command: ChatCommand | string) => typeof command === 'string' ? '' : command.name,
      renderOption: (defaultProps, command: ChatCommand) => {
        const { key, ...listItemProps } = defaultProps;
        return (
          <Box key={key} component="li" {...listItemProps} sx={{ padding: '4px 8px !important', gap: 2 }}>
            <Typography variant="body2" component="span" className="jp-chat-command-name">{command.name}</Typography>
            {command.description && <><span> - </span><Typography variant="caption" component="span" color="text.secondary">{command.description}</Typography></>}
          </Box>
        );
      },
      filterOptions: (cmds: ChatCommand[]) => cmds, value: null, autoHighlight: true, autoSelect: true, freeSolo: true, disableClearable: true,
      onChange, onHighlightChange: (_, opt) => { setHighlighted(!!opt); }, onClose: () => { setHighlighted(false); setOpen(false); }
    },
    menu: { open, highlighted }
  };
}
