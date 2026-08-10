import { IconButton, IconButtonProps, SxProps } from '@mui/material';
import React from 'react';
import { ContrastingTooltip } from './contrasting-tooltip';
import { TOOLTIPPED_WRAP_CLASS, TooltippedButtonProps } from './tooltipped-button';

export type TooltippedIconButtonProps = TooltippedButtonProps & {
  buttonProps?: IconButtonProps;
  sx?: SxProps;
};

export function TooltippedIconButton(props: TooltippedIconButtonProps): JSX.Element {
  return (
    <ContrastingTooltip
      title={props.tooltip}
      placement={props.placement ?? 'top'}
      slotProps={{ popper: { modifiers: [{ name: 'offset', options: { offset: [0, -8] } }] } }}
    >
      <span className={props.className ? `${props.className} ${TOOLTIPPED_WRAP_CLASS}` : TOOLTIPPED_WRAP_CLASS}>
        <IconButton
          {...props.buttonProps}
          onClick={props.onClick}
          disabled={props.disabled}
          aria-label={props['aria-label'] ?? props.tooltip}
          sx={props.sx}
        >
          {props.children}
        </IconButton>
      </span>
    </ContrastingTooltip>
  );
}
