import { Button, ButtonProps, SxProps, TooltipProps } from '@mui/material';
import React from 'react';
import { ContrastingTooltip } from './contrasting-tooltip';

export const TOOLTIPPED_WRAP_CLASS = 'jp-chat-tooltipped-wrap';

export type TooltippedButtonProps = {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  tooltip: string;
  children: JSX.Element;
  className?: string;
  inputToolbar?: boolean;
  disabled?: boolean;
  placement?: TooltipProps['placement'];
  'aria-label'?: string;
  buttonProps?: ButtonProps;
  sx?: SxProps;
};

export function TooltippedButton(props: TooltippedButtonProps): JSX.Element {
  return (
    <ContrastingTooltip
      title={props.tooltip}
      placement={props.placement ?? 'top'}
      slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [0, -8] } }] } }}
    >
      <span className={props.className ? `${props.className} ${TOOLTIPPED_WRAP_CLASS}` : TOOLTIPPED_WRAP_CLASS}>
        <Button
          {...props.buttonProps}
          onClick={props.onClick}
          disabled={props.disabled}
          aria-label={props['aria-label'] ?? props.tooltip}
          variant="text"
        >
          {props.children}
        </Button>
      </span>
    </ContrastingTooltip>
  );
}
