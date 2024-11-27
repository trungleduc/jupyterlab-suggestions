import { PanelWithToolbar } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';

import { ISuggestionChange, ISuggestionsModel } from '../types';
import { CellWidget } from './cellWidget';
import {
  suggestionCellSelectedStyle,
  suggestionsWidgetAreaStyle
} from './style';

export class SuggestionsWidget extends PanelWithToolbar {
  constructor(options: SuggestionsWidget.IOptions) {
    super(options);
    this.title.label = 'All Suggestions';
    this._model = options.model;
    this._suggestionsArea.addClass(suggestionsWidgetAreaStyle);
    this.addWidget(this._suggestionsArea);

    this._renderSuggestions();

    this._model.suggestionChanged.connect(this._updateSuggestions, this);

    this._model.notebookSwitched.connect(this._handleNotebookSwitched, this);

    this._model.activeCellChanged.connect(this._handleActiveCellChanged, this);
  }

  dispose(): void {
    this._model.suggestionChanged.disconnect(this._updateSuggestions);

    this._model.notebookSwitched.disconnect(this._handleNotebookSwitched);

    this._model.activeCellChanged.disconnect(this._handleActiveCellChanged);
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
          w.addClass(suggestionCellSelectedStyle);
          this._suggestionsArea.addWidget(w);
        }
        break;
      }

      default:
        break;
    }
  }

  private _handleActiveCellChanged(
    sender: ISuggestionsModel,
    args: { cellId?: string }
  ) {
    for (const w of this._suggestionsArea.widgets as CellWidget[]) {
      if (w.cellId === args.cellId) {
        w.addClass(suggestionCellSelectedStyle);
      } else {
        w.removeClass(suggestionCellSelectedStyle);
      }
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
      for (const val of allSuggestions.values()) {
        Object.entries(val).forEach(([suggestionId, suggestionDef]) => {
          const w = new CellWidget({ cellModel: suggestionDef.content });
          w.id = suggestionId;
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
