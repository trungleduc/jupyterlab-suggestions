import { style } from 'typestyle';

export const toolbarMenuButtonStyle = style({
  height: '29px'
});

export const toolbarMenuStyle = style({
  height: 'auto',
  width: 'max-content',
  color: 'var(--jp-ui-font-color1)',
  textAlign: 'justify',
  borderRadius: '6px',
  padding: '0 5px',
  position: 'fixed',
  display: 'table',
  visibility: 'hidden',
  transform: 'translateX(calc(-100% + 30px)) translateY(calc(30px))'
});

export const toolbarMenuItemStyle = style({
  $nest: {
    '&:hover': {
      background: 'var(--jp-layout-color2)'
    },
    '& > .lm-Menu-itemIcon': {
      display: 'inline-block',
      verticalAlign: 'middle',
      $nest: {
        '& > div': {
          display: 'flex'
        }
      }
    }
  }
});

export const activated = style({
  boxShadow: 'inset 0px 0px 2px 2px var(--neutral-fill-hover)',
  background: 'var(--jp-layout-color0)'
});

export const cellWithSuggestionStyle = style({
  $nest: {
    '& path': {
      fill: 'var(--jp-brand-color1)!important'
    }
  }
});
