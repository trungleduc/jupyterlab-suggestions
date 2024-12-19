import { style } from 'typestyle';
import { NestedCSSProperties } from 'typestyle/lib/types';
import crossStr from '../../../style/icon/cross.svg';

export const toolbarStyle = style({
  height: '26px',
  borderBottom: 'var(--jp-border-width) solid var(--jp-toolbar-border-color)',
  boxShadow: 'var(--jp-toolbar-box-shadow)',
  background: 'var(--jp-toolbar-background)',
  display: 'flex',
  flexDirection: 'row-reverse'
});
export const toolbarButtonStyle = style({
  margin: '0px!important'
});

export const suggestionCellStyle = style({
  background: 'var(--jp-cell-editor-background)',
  margin: '5px',
  border: 'var(--jp-border-width) solid var(--jp-cell-editor-border-color)',
  $nest: {
    '.minimize': {
      height: 0,
      overflow: 'hidden',
      padding: '0!important'
    }
  }
});
export const suggestionCellSelectedStyle = style({
  $nest: {
    '> div': {
      border:
        'var(--jp-border-width) solid var(--jp-cell-editor-active-border-color)!important',
      boxShadow: 'var(--jp-elevation-z4)'
    }
  }
});

const commonStyle: NestedCSSProperties = {
  content: '""',
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '100% 100%',

  pointerEvents: 'none'
};
export const deletedCellStyle = style({
  $nest: {
    '&::before': {
      ...commonStyle,
      backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(crossStr)}")`,
      zIndex: 2000
    },
    '&::after': {
      ...commonStyle,
      backgroundColor: '#ff000012',
      zIndex: 3000
    }
  }
});
