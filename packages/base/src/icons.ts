import { LabIcon } from '@jupyterlab/ui-components';
import hintStr from '../style/icon/hint.svg';
import minimizeStr from '../style/icon/minimize.svg';
import expandStr from '../style/icon/expand.svg';
import collapseStr from '../style/icon/collapse.svg';

export const hintIcon = new LabIcon({
  name: 'jupyter-suggestions:hintIcon',
  svgstr: hintStr
});
export const minimizeIcon = new LabIcon({
  name: 'jupyter-suggestions:minimizeIcon',
  svgstr: minimizeStr
});
export const expandIcon = new LabIcon({
  name: 'jupyter-suggestions:expandIcon',
  svgstr: expandStr
});
export const collapseIcon = new LabIcon({
  name: 'jupyter-suggestions:collapseIcon',
  svgstr: collapseStr
});
