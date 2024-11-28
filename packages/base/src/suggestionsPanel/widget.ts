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
    this._suggestionsArea.addClass('jp-scrollbar-tiny');
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
          const cellIdx = this._model.getCellIndex(cellId);

          if (cellIdx in this._indexCount) {
            this._indexCount[cellIdx] += 1;
          } else {
            this._indexCount[cellIdx] = 1;
          }
          let suggestionPos = 0;
          for (let key = 0; key <= cellIdx; key++) {
            suggestionPos += this._indexCount[key] ?? 0;
          }

          const w = new CellWidget({ cellModel: suggestion.content });
          w.id = suggestionId;
          w.addClass(suggestionCellSelectedStyle);
          this._suggestionsArea.insertWidget(suggestionPos - 1, w);
          this._scrollToWidget(w);
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
    const widgetLength = this._suggestionsArea.widgets.length;
    let matched = false;
    for (let widgetIdx = 0; widgetIdx < widgetLength; widgetIdx++) {
      const w = this._suggestionsArea.widgets[widgetIdx] as CellWidget;

      if (w.cellId === args.cellId) {
        w.addClass(suggestionCellSelectedStyle);
        if (!matched) {
          matched = true;
          this._scrollToWidget(w);
        }
      } else {
        w.removeClass(suggestionCellSelectedStyle);
      }
    }
  }

  private _scrollToWidget(w: CellWidget) {
    const topPos = w.node.offsetTop;
    this._suggestionsArea.node.scrollTop = topPos;
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
  private _indexCount: { [key: number]: number } = {};
  private _model: ISuggestionsModel;
}

export namespace SuggestionsWidget {
  export interface IOptions extends PanelWithToolbar.IOptions {
    model: ISuggestionsModel;
  }
}
