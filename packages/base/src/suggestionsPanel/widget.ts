import { PanelWithToolbar } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';

import { ISuggestionChange, ISuggestionsModel } from '../types';
import { CellWidget } from './cellWidget';
import { suggestionsWidgetAreaStyle } from './style';

export class SuggestionsWidget extends PanelWithToolbar {
  constructor(options: SuggestionsWidget.IOptions) {
    super(options);
    this.title.label = 'All Suggestions';
    this._model = options.model;
    this._suggestionsArea.addClass(suggestionsWidgetAreaStyle);
    this.addWidget(this._suggestionsArea);

    this._renderSuggestions();

    this._model.notebookSwitched.connect(() => {
      this._renderSuggestions();
    });
    this._model.suggestionChanged.connect(this._updateSuggestions, this);

    this._model.notebookSwitched.connect(this._handleNotebookSwitched, this);
  }

  private _updateSuggestions(
    _: ISuggestionsModel,
    changedArg: Omit<ISuggestionChange, 'notebookPath'>
  ) {
    const { operator, cellId, suggestionId } = changedArg;
    switch (operator) {
      case 'added': {
        const suggestion = this._model.getSuggestion({ cellId, suggestionId });
        if (suggestion) {
          const w = new CellWidget({ cellModel: suggestion.content });
          w.id = suggestionId;
          // w.node.innerHTML = `<pre>${JSON.stringify(suggestion, null, 2)}</pre>`;
          this._suggestionsArea.addWidget(w);
        }
        break;
      }

      default:
        break;
    }
  }

  private _handleNotebookSwitched() {
    this._renderSuggestions();
  }
  private _renderSuggestions() {
    const allSuggestions = this._model.allSuggestions;
    const allWidgets = [...this._suggestionsArea.widgets];
    for (const element of allWidgets) {
      element.parent = null;
    }
    if (allSuggestions) {
      for (const [_, val] of allSuggestions.entries()) {
        Object.entries(val).forEach(([suggestionId, suggestionDef]) => {
          const w = new CellWidget({ cellModel: suggestionDef.content });
          w.id = suggestionId;
          // w.node.innerHTML = `<pre>${JSON.stringify(suggestionDef, null, 2)}</pre>`;
          this._suggestionsArea.addWidget(w);
        });
      }
    }
  }
  private _suggestionsArea = new Panel();
  private _model: ISuggestionsModel;
}

export namespace SuggestionsWidget {
  export interface IOptions extends PanelWithToolbar.IOptions {
    model: ISuggestionsModel;
  }
}
