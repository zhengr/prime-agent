import { PromiseDelegate } from '@lumino/coreutils';
import { MessageLoop } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageToolbar } from './toolbar';
import { CodeToolbar } from '../code-blocks/code-toolbar';
import { useChatContext } from '../../context';
import { IMessageContent } from '../../types';
import { replaceMentionToSpan } from '../../utils';

const RENDERED_CLASS = 'jp-chat-rendered-message';
const DEFAULT_MIME_TYPE = 'text/markdown';

type MessageRendererProps = {
  message: IMessageContent;
  rendered: PromiseDelegate<void>;
  edit?: () => void;
  delete?: () => void;
};

function MessageRendererBase(props: MessageRendererProps): JSX.Element {
  const { message } = props;
  const { model, rmRegistry } = useChatContext();
  const [renderedContent, setRenderedContent] = useState<HTMLElement | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [codeToolbarDefns, setCodeToolbarDefns] = useState<Array<[HTMLDivElement, { model: any; content: string }]>>([]);

  useEffect(() => {
    const renderContent = async () => {
      let isMarkdownRenderer = true;
      let renderer: any;
      let mimeModel: any;

      if (message.mime_model) {
        setCanEdit(false);
        let mimeContent = message.mime_model;
        const preferred = rmRegistry.preferredMimeType(mimeContent.data, 'ensure') || DEFAULT_MIME_TYPE;
        renderer = rmRegistry.createRenderer(preferred);
        mimeModel = rmRegistry.createModel(mimeContent);
      } else {
        setCanEdit(true);
        let mdStr = message.body;
        message.mentions?.forEach(user => { mdStr = replaceMentionToSpan(mdStr, user); });
        renderer = rmRegistry.createRenderer(DEFAULT_MIME_TYPE);
        mimeModel = rmRegistry.createModel({ data: { [DEFAULT_MIME_TYPE]: mdStr } });
      }

      await renderer.renderModel(mimeModel);
      MessageLoop.sendMessage(renderer, Widget.Msg.AfterAttach);

      if (isMarkdownRenderer) {
        const newDefs: Array<[HTMLDivElement, { model: any; content: string }]> = [];
        renderer.node.querySelectorAll('pre').forEach((preBlock: HTMLElement) => {
          const codeToolbarRoot = document.createElement('div');
          preBlock.parentNode?.insertBefore(codeToolbarRoot, preBlock.nextSibling);
          newDefs.push([codeToolbarRoot, { model: model, content: preBlock.textContent || '' }]);
        });
        setCodeToolbarDefns(newDefs);
      }

      setRenderedContent(renderer.node);
      props.rendered.resolve();
    };
    renderContent();
  }, [message.body, message.mime_model, message.mentions, rmRegistry]);

  return (
    <>
      {renderedContent && (
        <div className={RENDERED_CLASS} ref={node => node && node.replaceChildren(renderedContent)} />
      )}
      <MessageToolbar edit={canEdit ? props.edit : undefined} delete={props.delete} />
      {codeToolbarDefns.map(([root, toolbarProps]) => (
        createPortal(<CodeToolbar {...toolbarProps} />, root)
      ))}
    </>
  );
}

export const MessageRenderer = React.memo(MessageRendererBase);
