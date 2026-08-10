import { Box } from '@mui/material';
import clsx from 'clsx';
import React, { useEffect, useState, useRef } from 'react';
import { ChatMessageHeader } from './header';
import { ChatMessage, MESSAGE_CONTAINER_CLASS } from './message';
import { Navigation } from './navigation';
import { WelcomeMessage } from './welcome';
import { ChatBodyPlaceholder } from './chat-body-placeholder';
import { MessageFooterComponent } from './footer';
import { MessagePreambleComponent } from './preamble';
import { ScrollContainer } from '../scroll-container';
import { useChatContext } from '../../context';
import { IMessage } from '../../types';

export const MESSAGE_CLASS = 'jp-chat-message';
const MESSAGES_BOX_CLASS = 'jp-chat-messages-container';

export function ChatMessages(): JSX.Element {
  const { model } = useChatContext();
  const [messages, setMessages] = useState<IMessage[]>(model.messages);
  const refMsgBox = useRef<HTMLDivElement>(null);
  const [allRendered, setAllRendered] = useState(false);
  const [showDeleted, setShowDeleted] = useState(model.config.showDeleted ?? false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(true);

  useEffect(() => {
    function handleChatEvents() {
      const viewport = model.messagesInViewport ?? [];
      const prevLastIdx = model.messages.length - 2;
      shouldScrollRef.current = prevLastIdx < 0 || viewport.includes(prevLastIdx);
      setMessages([...model.messages]);
    }
    model.messagesUpdated.connect(handleChatEvents);
    return () => { model.messagesUpdated.disconnect(handleChatEvents); };
  }, [model]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const observer = new MutationObserver(() => { if (shouldScrollRef.current) el.scrollTop = el.scrollHeight; });
    const handleScroll = () => { const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40; shouldScrollRef.current = atBottom; };
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    el.addEventListener('scroll', handleScroll);
    return () => { observer.disconnect(); el.removeEventListener('scroll', handleScroll); };
  }, []);

  useEffect(() => {
    function handleConfigChange(_: any, config: any) {
      if (config.showDeleted !== showDeleted) setShowDeleted(config.showDeleted ?? false);
    }
    model.configChanged.connect(handleConfigChange);
    return () => { model.configChanged.disconnect(handleConfigChange); };
  }, [model, showDeleted]);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (!allRendered) {
        const promises = (showDeleted ? messages : messages.filter(m => !m.deleted)).map(msg => msg.renderedDelegate.promise);
        Promise.all(promises).then(() => setAllRendered(true));
      }
      const inViewport = [...(model.messagesInViewport ?? [])];
      entries.forEach(entry => {
        const index = parseInt(entry.target.getAttribute('data-index') ?? '');
        if (!isNaN(index)) {
          const idx = inViewport.indexOf(index);
          if (!entry.isIntersecting && idx !== -1) inViewport.splice(idx, 1);
          else if (entry.isIntersecting && idx === -1) inViewport.push(index);
        }
      });
      model.messagesInViewport = inViewport;
    });
    refMsgBox.current?.querySelectorAll(`.${MESSAGE_CONTAINER_CLASS}`).forEach(item => observer.observe(item));
    return () => { observer.disconnect(); };
  }, [messages, showDeleted, allRendered]);

  const horizontalPadding = 4;
  return (
    <>
      <ScrollContainer ref={scrollContainerRef} sx={{ flexGrow: 1 }}>
        <Box sx={{ paddingLeft: horizontalPadding, paddingRight: horizontalPadding, paddingTop: 4, paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 4 }}
          ref={refMsgBox} className={clsx(MESSAGES_BOX_CLASS)}>
          {(showDeleted ? messages : messages.filter(m => !m.deleted)).map((message, i) => {
            const isCurrentUser = model.user !== undefined && model.user.username === message.sender.username;
            return (
              <Box key={message.id}
                sx={isCurrentUser ? { marginLeft: '10%', backgroundColor: 'var(--jp-layout-color2)', border: 'none', borderRadius: 2, padding: 2 } : {}}
                className={clsx(MESSAGE_CLASS, message.stacked ? 'jp-chat-message-stacked' : '')}>
                <ChatMessageHeader message={message} isCurrentUser={isCurrentUser} />
                <ChatMessage message={message} index={i} />
              </Box>
            );
          })}
        </Box>
      </ScrollContainer>
      <Navigation refMsgBox={refMsgBox} allRendered={allRendered} />
    </>
  );
}
