import { Box, SxProps, Theme, Typography } from '@mui/material';
import React from 'react';
import { IChatModel } from '../model';

const WRITERS_ELEMENT_CLASSNAME = 'jp-chat-writers';

export interface IInputWritingIndicatorProps {
  writers: IChatModel.IWriter[];
  sx?: SxProps<Theme>;
}

function formatWritersText(writers: IChatModel.IWriter[]): string {
  if (writers.length === 0) return '';
  const names = writers.map(w => w.user.display_name ?? w.user.name ?? w.user.username ?? 'Unknown');
  if (names.length === 1) return `${names[0]} is typing...`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]} are typing...`;
}

export function WritingIndicator(props: IInputWritingIndicatorProps): JSX.Element {
  const { writers } = props;
  const writersText = writers.length > 0 ? formatWritersText(writers) : '';
  return (
    <Box className={WRITERS_ELEMENT_CLASSNAME} sx={{ ...props.sx, minHeight: '16px' }}>
      <Typography variant="caption" sx={{
        color: 'var(--jp-ui-font-color2)', display: 'block', fontSize: '10px',
        fontFamily: 'var(--jp-ui-font-family)', lineHeight: '16px',
        visibility: writers.length > 0 ? 'visible' : 'hidden'
      }}>
        {writersText || '\u00A0'}
      </Typography>
    </Box>
  );
}
