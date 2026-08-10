import React from 'react';
import { styled, Tooltip, TooltipProps, tooltipClasses } from '@mui/material';

export const ContrastingTooltip = styled(
  ({ className, ...props }: TooltipProps) => (
    <Tooltip {...props} arrow classes={{ popper: className }} />
  )
)(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: theme.palette.common.black,
    color: theme.palette.common.white,
    boxShadow: theme.shadows[1],
    fontSize: 11
  },
  [`& .${tooltipClasses.arrow}`]: {
    color: theme.palette.common.black
  }
}));
