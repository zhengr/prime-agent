import { Box, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { Avatar } from '../avatar';
import { IMessageContent, IMessage } from '../../types';

const MESSAGE_HEADER_CLASS = 'jp-chat-message-header';

type ChatMessageHeaderProps = { message: IMessage; isCurrentUser?: boolean; };

export function ChatMessageHeaderBase(props: ChatMessageHeaderProps): JSX.Element {
  const [message, setMessage] = useState<IMessageContent>(props.message.content);
  const [datetime, setDatetime] = useState<Record<number, string>>({});
  const sender = message.sender;

  useEffect(() => {
    if (!datetime[message.time]) {
      const msgDate = new Date(message.time * 1000);
      const now = new Date();
      const sameDay = msgDate.toDateString() === now.toDateString();
      const dt = sameDay
        ? msgDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : msgDate.toLocaleString([], { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
      setDatetime(prev => ({ ...prev, [message.time]: dt }));
    }
  });

  useEffect(() => {
    function messageChanged() { setMessage(props.message.content); }
    props.message.changed.connect(messageChanged);
    return () => { props.message.changed.disconnect(messageChanged); };
  }, [props.message]);

  const avatar = message.stacked ? null : Avatar({ user: sender });
  const name = sender.display_name ?? sender.name ?? (sender.username || 'User');
  const onlyState = message.stacked && (message.deleted || message.edited);

  return message.stacked && !message.deleted && !message.edited ? (
    <></>
  ) : (
    <Box className={MESSAGE_HEADER_CLASS} sx={{ display: 'flex', alignItems: 'center', '& > :not(:last-child)': { marginRight: 3 }, marginBottom: message.stacked || props.isCurrentUser ? '0px' : '12px' }}>
      {!props.isCurrentUser && !onlyState && avatar}
      <Box sx={{ display: 'flex', flexGrow: 1, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {!onlyState && !props.isCurrentUser && (
            <Typography sx={{ fontWeight: 700, color: 'var(--jp-ui-font-color1)', paddingRight: '0.5em' }}>{name}</Typography>
          )}
          {(message.deleted || message.edited) && (
            <Typography sx={{ fontStyle: 'italic', fontSize: 'var(--jp-content-font-size0)' }}>
              {message.deleted ? '(message deleted)' : '(edited)'}
            </Typography>
          )}
        </Box>
        {!onlyState && (
          <Typography sx={{ fontSize: '0.8em', color: 'var(--jp-ui-font-color2)', fontWeight: 300 }}>
            {`${datetime[message.time] || ''}${message.raw_time ? '*' : ''}`}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export const ChatMessageHeader = React.memo(ChatMessageHeaderBase);
