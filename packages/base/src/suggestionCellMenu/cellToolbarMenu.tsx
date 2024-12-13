import * as React from 'react';
import { ReactWidget, ToolbarButtonComponent } from '@jupyterlab/ui-components';
import { Cell } from '@jupyterlab/cells';
import { hintIcon } from '../icons';
import { toolbarMenuButtonStyle, toolbarMenuStyle } from './style';

interface IProps {
  cell?: Cell;
}
function _CellToolbarMenuReact(props: IProps) {
  return (
    <div className={toolbarMenuButtonStyle}>
      <ToolbarButtonComponent icon={hintIcon} />

      <div className={`lm-Menu ${toolbarMenuStyle}`}>
        <ul className="lm-Menu-content">
          <li aria-haspopup="true" className="lm-Menu-item" data-type="submenu">
            <div className="f1vya9e0 lm-Menu-itemIcon"></div>
            <div className="lm-Menu-itemLabel">Suggest change</div>
          </li>
          <li aria-haspopup="true" className="lm-Menu-item" data-type="submenu">
            <div className="f1vya9e0 lm-Menu-itemIcon"></div>
            <div style={{ padding: 0 }} className="lm-Menu-itemLabel">
              Suggest delete
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}

const CellToolbarMenuReact = React.memo(_CellToolbarMenuReact);

export class CellToolbarMenu extends ReactWidget {
  constructor(private options: IProps) {
    super();
  }

  render(): JSX.Element {
    return <CellToolbarMenuReact {...this.options} />;
  }
}
