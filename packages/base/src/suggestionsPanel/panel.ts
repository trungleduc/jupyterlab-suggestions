import { SidePanel } from '@jupyterlab/ui-components';

import { ISuggestionsModel } from '../types';
import { SuggestionsPanelHeader } from './header';
import { mainPanelStyle } from './style';
import { Signal } from '@lumino/signaling';

export class SuggestionsPanelWidget extends SidePanel {
  constructor(options: SuggestionsPanelWidget.IOptions) {
    super();
    this.addClass(mainPanelStyle);
    this.node.tabIndex = 0;
    this._model = options.model;

    this.header.addWidget(this._headerWidget);

    this.connectSignal();
    this._handleNotebookSwitched();
  }

  get model(): ISuggestionsModel {
    return this._model;
  }
  connectSignal() {
    this._model.notebookSwitched.connect(this._handleNotebookSwitched, this);
  }

  disconnectSignal() {
    this._model.notebookSwitched.disconnect(this._handleNotebookSwitched);
    Signal.clearData(this);
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.disconnectSignal();
    super.dispose();
  }

  private _handleNotebookSwitched() {
    const filePath = this._model.filePath;
    this._headerWidget.title.label = filePath;
  }
  private _model: ISuggestionsModel;
  private _headerWidget = new SuggestionsPanelHeader();
}

export namespace SuggestionsPanelWidget {
  export interface IOptions {
    model: ISuggestionsModel;
  }
}
