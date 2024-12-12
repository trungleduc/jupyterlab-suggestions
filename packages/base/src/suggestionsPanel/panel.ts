import { SidePanel } from '@jupyterlab/ui-components';
import { Signal } from '@lumino/signaling';

import { ISuggestionsModel } from '../types';
import { SuggestionsPanelHeader } from './header';
import { mainPanelStyle } from './style';
import { SuggestionsWidget } from './widget';

export class SuggestionsPanelWidget extends SidePanel {
  constructor(options: SuggestionsPanelWidget.IOptions) {
    super(options);
    this.addClass(mainPanelStyle);
    this.node.tabIndex = 0;
    this._model = options.model;
    this.header.addWidget(this._headerWidget);

    this.connectSignal();
    this._handleAllSuggestionsChanged();
    const widget = new SuggestionsWidget({ model: this._model });
    this.addWidget(widget);
  }

  connectSignal() {
    this._model.allSuggestionsChanged.connect(
      this._handleAllSuggestionsChanged,
      this
    );
  }

  disconnectSignal() {
    this._model.allSuggestionsChanged.disconnect(
      this._handleAllSuggestionsChanged
    );
    Signal.clearData(this);
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.disconnectSignal();
    super.dispose();
  }

  private _handleAllSuggestionsChanged() {
    const filePath = this._model.filePath;
    const managerName = this._model.getSuggestionManagerName();
    this._headerWidget.title.label = `${managerName} - ${filePath}`;
  }

  private _model: ISuggestionsModel;
  private _headerWidget = new SuggestionsPanelHeader();
}

export namespace SuggestionsPanelWidget {
  export interface IOptions extends SidePanel.IOptions {
    model: ISuggestionsModel;
  }
}
