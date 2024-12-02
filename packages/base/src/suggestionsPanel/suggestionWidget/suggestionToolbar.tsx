import * as React from 'react';
import { ReactWidget, ToolbarButtonComponent } from '@jupyterlab/apputils';
import { toolbarButtonStyle, toolbarStyle } from './style';
import { checkIcon, closeIcon } from '@jupyterlab/ui-components';
import { collapseIcon, expandIcon } from '../../icons';
import { IObservableMap } from '@jupyterlab/observables';
import { JSONValue } from '@lumino/coreutils';
interface IProps {
  author?: string;
  state: IObservableMap<JSONValue>;
  toggleMinimized: (min: boolean) => void;
  deleteCallback: () => Promise<void>;
  acceptCallback: () => Promise<void>;
}
function _SuggestionToolbarReact(props: IProps) {
  const minimizeClick = React.useCallback(() => {
    props.toggleMinimized(!props.state.get('minimized'));
  }, [props.toggleMinimized, props.state]);

  const [elementState, setElementState] = React.useState({
    minimized: props.state.get('minimized')
  });
  React.useEffect(() => {
    const handler = () => {
      const current = props.state.get('minimized');
      setElementState(old => ({ ...old, minimized: current }));
    };
    props.state.changed.connect(handler);
    return () => {
      props.state.changed.disconnect(handler);
    };
  }, [props.state]);
  return (
    <div className={toolbarStyle}>
      <ToolbarButtonComponent
        className={toolbarButtonStyle}
        icon={closeIcon}
        onClick={props.deleteCallback}
        iconLabel={'Delete'}
      />
      <ToolbarButtonComponent
        className={toolbarButtonStyle}
        icon={checkIcon}
        onClick={props.acceptCallback}
        iconLabel={'Accept suggestion'}
      />
      <ToolbarButtonComponent
        className={toolbarButtonStyle}
        icon={elementState.minimized ? expandIcon : collapseIcon}
        onClick={minimizeClick}
        iconLabel={elementState.minimized ? 'Expand' : 'Collapse'}
      />
    </div>
  );
}

const SuggestionToolbarReact = React.memo(_SuggestionToolbarReact);

export class SuggestionToolbar extends ReactWidget {
  constructor(private options: IProps) {
    super();
  }

  render(): JSX.Element {
    return <SuggestionToolbarReact {...this.options} />;
  }
}
