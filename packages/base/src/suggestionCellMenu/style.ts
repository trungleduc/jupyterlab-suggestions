import { style } from 'typestyle';

export const toolbarMenuButtonStyle = style({
  height: '29px'
});

export const toolbarMenuStyle = style({
  // visibility: 'hidden',
  height: 'auto',
  width: 'max-content',
  backgroundColor: 'var(--jp-layout-color2)',
  color: 'var(--jp-ui-font-color1)',
  textAlign: 'justify',
  borderRadius: '6px',
  padding: '0 5px',
  position: 'fixed',
  display: 'table',
  transform: 'translateX(calc(-100% + 25px)) translateY(5px)'
});
