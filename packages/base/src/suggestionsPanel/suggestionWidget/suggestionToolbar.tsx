import * as React from 'react';
import { ReactWidget, ToolbarButtonComponent } from '@jupyterlab/apputils';
import { toolbarButtonStyle, toolbarStyle } from './style';
import { checkIcon, closeIcon } from '@jupyterlab/ui-components';
import { collapseIcon, expandIcon, locationIcon } from '../../icons';
import { IObservableMap } from '@jupyterlab/observables';
import { JSONValue } from '@lumino/coreutils';
import { ISuggestionMetadata } from '../../types';
interface IProps {
  author?: string;
  state: IObservableMap<JSONValue>;
  toggleMinimized: (min: boolean) => void;
  deleteCallback: () => Promise<void>;
  acceptCallback: () => Promise<void>;
  navigateCallback: () => Promise<void>;
  metadata: ISuggestionMetadata;
}
function _SuggestionToolbarReact(props: IProps) {
  const { toggleMinimized, state } = props;
  const minimizeClick = React.useCallback(() => {
    toggleMinimized(!state.get('minimized'));
  }, [toggleMinimized, state]);

  const [elementState, setElementState] = React.useState({
    minimized: state.get('minimized')
  });
  React.useEffect(() => {
    const handler = () => {
      const current = state.get('minimized');
      setElementState(old => ({ ...old, minimized: current }));
    };
    state.changed.connect(handler);
    return () => {
      state.changed.disconnect(handler);
    };
  }, [state]);
  const userData = props.metadata?.author;
  return (
    <div className={toolbarStyle}>
      {userData && (
        <div
          title={userData.display_name}
          className={'lm-MenuBar-itemIcon jp-MenuBar-anonymousIcon'}
          style={{ backgroundColor: userData.color }}
        >
          <span>{userData.initials}</span>
        </div>
      )}
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
      <ToolbarButtonComponent
        className={toolbarButtonStyle}
        icon={locationIcon}
        onClick={props.navigateCallback}
        iconLabel={'Navigate to cell'}
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
