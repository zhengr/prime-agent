import React, { useEffect, useState } from 'react';
import { useChatContext } from '../../context';
import { IChatModel } from '../../model';

const NAVIGATION_BUTTON_CLASS = 'jp-chat-navigation';

type NavigationProps = { refMsgBox: React.RefObject<HTMLDivElement>; allRendered: boolean; };

export function Navigation(props: NavigationProps): JSX.Element {
  const { model } = useChatContext();
  const [lastInViewport, setLastInViewport] = useState(true);

  useEffect(() => {
    const viewportChanged = (model: IChatModel, viewport: number[]) => {
      setLastInViewport(model.messages.length === 0 || viewport.includes(model.messages.length - 1));
    };
    model.viewportChanged?.connect(viewportChanged);
    viewportChanged(model, model.messagesInViewport ?? []);
    return () => { model.viewportChanged?.disconnect(viewportChanged); };
  }, [model]);

  const gotoMessage = (msgIdx: number, alignToTop: boolean = true) => {
    props.refMsgBox.current?.children.item(msgIdx)?.scrollIntoView(alignToTop);
  };

  return (
    <>
      {!lastInViewport && (
        <button className={`${NAVIGATION_BUTTON_CLASS} jp-chat-navigation-bottom`}
          onClick={() => gotoMessage(model.messages.length - 1, false)}
          style={{ position: 'absolute', right: 10, bottom: 120, width: 24, height: 24, borderRadius: '50%', border: 'none', cursor: 'pointer' }}>
          ▼
        </button>
      )}
    </>
  );
}
