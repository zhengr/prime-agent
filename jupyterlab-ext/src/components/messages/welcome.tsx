import { MessageLoop } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import React, { useEffect, useRef } from 'react';
import { useChatContext } from '../../context';

const WELCOME_MESSAGE_CLASS = 'jp-chat-welcome-message';
const MD_MIME_TYPE = 'text/markdown';

export interface IWelcomeMessageProps { content: string; }

export function WelcomeMessage(props: IWelcomeMessageProps): JSX.Element {
  const { rmRegistry } = useChatContext();
  const content = props.content + '\n----\n';
  const renderingContainer = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let node: HTMLElement | null = null;
    const renderContent = async () => {
      const renderer = rmRegistry.createRenderer(MD_MIME_TYPE);
      const mimeModel = rmRegistry.createModel({ data: { [MD_MIME_TYPE]: content } });
      await renderer.renderModel(mimeModel);
      MessageLoop.sendMessage(renderer, Widget.Msg.AfterAttach);
      node = renderer.node;
      renderingContainer.current?.append(node);
    };
    renderContent();
    return () => { if (node && renderingContainer.current?.contains(node)) renderingContainer.current.removeChild(node); node = null; };
  }, [content]);

  return <div className={WELCOME_MESSAGE_CLASS} ref={renderingContainer}></div>;
}
