import { PromiseDelegate } from '@lumino/coreutils';
import React, { useCallback, useEffect, useState } from 'react';
import { MessageRenderer } from './message-renderer';
import { AttachmentPreviewList } from '../attachments';
import { ChatInput } from '../input';
import { useChatContext } from '../../context';
import { InputModel } from '../../input-model';
import { IMessageContent, IMessage, INewMessage } from '../../types';
import { replaceSpanToMention } from '../../utils';

export const MESSAGE_CONTAINER_CLASS = 'jp-chat-message-container';

type ChatMessageProps = { message: IMessage; index: number; };

function ChatMessageBase(props: ChatMessageProps): JSX.Element {
  const { model } = useChatContext();
  const [message, setMessage] = useState<IMessageContent>(props.message.content);
  const [renderedDelegate, setRenderedDelegate] = useState<PromiseDelegate<void>>(props.message.renderedDelegate);
  const [edit, setEdit] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    setDeleted(message.deleted ?? false);
    if (model.user && !message.deleted) {
      if (model.user.username === message.sender.username) {
        setCanEdit(!!model.updateMessage);
        setCanDelete(!!model.deleteMessage);
        return;
      }
      if (message.sender.bot) { setCanDelete(!!model.deleteMessage); }
    }
    setCanEdit(false);
    setCanDelete(false);
  }, [model, message]);

  useEffect(() => {
    function messageChanged() { setMessage(props.message.content); setRenderedDelegate(props.message.renderedDelegate); }
    props.message.changed.connect(messageChanged);
    setMessage(props.message.content);
    setRenderedDelegate(props.message.renderedDelegate);
    return () => { props.message.changed.disconnect(messageChanged); };
  }, [props.message]);

  const startEdition = useCallback((): void => {
    if (!canEdit || !(typeof message.body === 'string')) return;
    if (!model.addEditionModel) return;
    let body = message.body;
    message.mentions?.forEach(user => { body = replaceSpanToMention(body, user); });
    const inputModel = new InputModel({
      onSend: (newMessage: INewMessage) => updateMessage(message.id, newMessage),
      onCancel: () => cancelEdition(),
      value: body,
      config: { sendWithShiftEnter: model.config.sendWithShiftEnter }
    });
    model.addEditionModel(message.id, inputModel);
    setEdit(true);
  }, [canEdit, model, message]);

  const cancelEdition = useCallback((): void => {
    model.getEditionModel?.(message.id)?.dispose();
    setEdit(false);
  }, [model, message]);

  const updateMessage = useCallback((id: string, newMessage: INewMessage): void => {
    const inputModel = model.getEditionModel?.(id);
    if (!canEdit || !inputModel || !model.updateMessage) { setEdit(false); return; }
    const updatedMessage = { ...message };
    if (newMessage.body) updatedMessage.body = newMessage.body;
    model.updateMessage(id, updatedMessage);
    inputModel.dispose();
    setEdit(false);
  }, [model, message, canEdit]);

  const deleteMessage = useCallback((id: string): void => {
    if (!canDelete || !model.deleteMessage) return;
    model.deleteMessage(id);
  }, [model, canDelete]);

  useEffect(() => { if (deleted) renderedDelegate.resolve(); }, [deleted, renderedDelegate]);

  if (deleted) return <div data-index={props.index}></div>;

  const editionModel = model.getEditionModel?.(message.id);

  return (
    <div data-index={props.index} className={MESSAGE_CONTAINER_CLASS}>
      {edit && canEdit && editionModel ? (
        <ChatInput onCancel={() => cancelEdition()} model={editionModel} edit={true} />
      ) : (
        <MessageRenderer message={message} edit={canEdit ? startEdition : undefined}
          delete={canDelete ? () => deleteMessage(message.id) : undefined} rendered={renderedDelegate} />
      )}
      {message.attachments && !edit && <AttachmentPreviewList attachments={message.attachments} />}
    </div>
  );
}

export const ChatMessage = React.memo(ChatMessageBase);
