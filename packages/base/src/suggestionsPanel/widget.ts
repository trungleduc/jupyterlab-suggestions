import { PanelWithToolbar } from '@jupyterlab/ui-components';
import { Panel, Widget } from '@lumino/widgets';

import {
  IDict,
  ISuggestionChange,
  ISuggestionViewData,
  ISuggestionsModel
} from '../types';
import { CellWidget, suggestionCellSelectedStyle } from './suggestionWidget';
import { suggestionsWidgetAreaStyle } from './style';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { ISharedCell } from '@jupyter/ydoc';
import { Debouncer } from '@lumino/polling';

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

    this._model.allSuggestionsChanged.connect(this._renderSuggestions, this);

    this._model.activeCellChanged.connect(this._handleActiveCellChanged, this);
  }

  dispose(): void {
    this._model.suggestionChanged.disconnect(this._updateSuggestions);

    this._model.allSuggestionsChanged.disconnect(this._renderSuggestions);

    this._model.activeCellChanged.disconnect(this._handleActiveCellChanged);
  }
  private async _updateSuggestions(
    _: ISuggestionsModel,
    changedArg: Omit<ISuggestionChange, 'notebookPath'>
  ) {
    const { operator, cellId, suggestionId } = changedArg;
    switch (operator) {
      case 'added': {
        const suggestion = await this._model.getSuggestion({
          cellId,
          suggestionId
        });
        if (suggestion) {
          const { widget } = this._widgetFactory({
            suggestionId,
            suggestionData: suggestion
          });
          const cellIdx = this._model.getCellIndex(cellId);
          let cellSuggestionPanel = this._cellSuggestionsPanel.get(cellId);
          if (!cellSuggestionPanel) {
            cellSuggestionPanel = new Panel();
            this._cellSuggestionsPanel.set(cellId, cellSuggestionPanel);
            this._suggestionsArea.insertWidget(cellIdx, cellSuggestionPanel);
          }
          cellSuggestionPanel.addWidget(widget);

          this._highlightCellSuggestions(cellId);
        }
        break;
      }
      case 'deleted': {
        const cellSuggestionsPanel = this._cellSuggestionsPanel.get(cellId);
        if (!cellSuggestionsPanel) {
          break;
        }
        const allWidgets = [...cellSuggestionsPanel.widgets];
        for (const element of allWidgets) {
          if (element.id === suggestionId) {
            element.dispose();
            element.parent = null;
            break;
          }
        }
        break;
      }
      case 'modified': {
        break;
        // const suggestion = await this._model.getSuggestion({
        //   cellId,
        //   suggestionId
        // });
        // const cellSuggestionsPanel = this._cellSuggestionsPanel.get(cellId);
        // if (!cellSuggestionsPanel) {
        //   break;
        // }
        // const allWidgets = [...cellSuggestionsPanel.widgets] as CellWidget[];
        // for (const element of allWidgets) {
        //   if (element.id === suggestionId) {
        //     break;
        //   }
        // }
      }

      default:
        break;
    }

    this._updatePanelTitle();
  }

  private _handleActiveCellChanged(
    sender: ISuggestionsModel,
    args: { cellId?: string }
  ) {
    const { cellId } = args;
    cellId && this._highlightCellSuggestions(cellId);
  }
  private _highlightCellSuggestions(cellId: string): void {
    this._cellSuggestionsPanel.forEach((p, k) => {
      if (k === cellId) {
        p.addClass(suggestionCellSelectedStyle);
        let lastElement: Widget | undefined = undefined;
        for (const element of p.widgets) {
          (element as CellWidget).toggleMinimized(false);
          lastElement = element;
        }
        this._scrollToWidget(lastElement);
      } else {
        p.removeClass(suggestionCellSelectedStyle);
      }
    });
  }
  private _scrollToWidget(w?: Widget) {
    if (!w) {
      return;
    }
    const topPos = w.node.offsetTop;
    this._suggestionsArea.node.scrollTop = topPos;
  }

  private _renderSuggestions() {
    const allSuggestions = this._model.allSuggestions;

    this._cellSuggestionsPanel.forEach(p => {
      const allWidgets = [...p.widgets];
      for (const element of allWidgets) {
        p.layout?.removeWidget(element);
        element.dispose();
        element.parent = null;
      }
      p.dispose();
      p.parent = null;
      this._suggestionsArea.layout?.removeWidget(p);
    });
    this._cellSuggestionsPanel.clear();
    if (allSuggestions) {
      const suggestionPanelByIndex: IDict<Panel> = {};
      for (const [cellId, val] of allSuggestions.entries()) {
        const cellSuggestionPanel = new Panel();
        this._cellSuggestionsPanel.set(cellId, cellSuggestionPanel);
        const cellIdx = this._model.getCellIndex(cellId);
        suggestionPanelByIndex[cellIdx] = cellSuggestionPanel;
        Object.entries(val).forEach(([suggestionId, suggestionData]) => {
          const { widget } = this._widgetFactory({
            suggestionId,
            suggestionData
          });


          cellSuggestionPanel.addWidget(widget);
        });
      }
      const sortedKey = [...Object.keys(suggestionPanelByIndex)].sort(
        (a, b) => parseInt(a) - parseInt(b)
      );
      for (const k of sortedKey) {
        this._suggestionsArea.insertWidget(
          parseInt(k),
          suggestionPanelByIndex[k]
        );
      }
    }

    this._updatePanelTitle();

    const activeCell = this._model.getActiveCell();
    const activeCellId = activeCell?.model.id;
    this._handleActiveCellChanged(this._model, { cellId: activeCellId });
  }

  private _updatePanelTitle(): void {
    let count = 0;
    this._cellSuggestionsPanel.forEach(it => {
      count += it.widgets.length;
    });
    if (count !== 0) {
      this.title.label = `All Suggestions (${count})`;
    } else {
      this.title.label = 'All Suggestions';
    }
  }

  private _widgetFactory(options: {
    suggestionId: string;
    suggestionData: ISuggestionViewData;
  }): { widget: CellWidget } {
    const { suggestionId, suggestionData } = options;
    const cellId = suggestionData.originalCellModel.id as string | undefined;
    const deleteCallback = async () => {
      const { button } = await showDialog({
        title: 'Discard suggestion',
        body: 'Do you want to discard the suggestion?',
        buttons: [Dialog.cancelButton(), Dialog.okButton()],
        hasClose: true
      });
      if (button.accept) {
        await this._model.deleteSuggestion({ cellId, suggestionId });
      }
    };

    const debouncer = new Debouncer(async (cellModel: ISharedCell) => {
      const newContent = cellModel.toJSON();
      await this._model.updateSuggestion({
        cellId,
        suggestionId,
        newSource: newContent.source as string
      });
    }, 500);
    suggestionData.cellModel.sharedModel.changed.connect(
      async (cellModel, changed) => {
        debouncer.invoke(cellModel);
      }
    );
    suggestionData.cellModel.sharedModel.disposed.connect(
      () => void debouncer.dispose()
    );

    const acceptCallback = async () => {
      const accepted = await this._model.acceptSuggestion({
        cellId,
        suggestionId
      });
      if (!accepted) {
        const { button } = await showDialog({
          title: 'Error accepting suggestion',
          body: 'Cannot accept suggestion, do you want to discard it?',
          buttons: [Dialog.cancelButton(), Dialog.okButton()],
          hasClose: true
        });
        if (button.accept) {
          await this._model.deleteSuggestion({ cellId, suggestionId });
        }
      }
    };
    const w = new CellWidget({
      suggestionData,
      deleteCallback,
      acceptCallback,
      liveUpdate: this._model.sourceLiveUpdate
    });

    w.id = suggestionId;
    return { widget: w };
  }

  private _suggestionsArea = new Panel();
  private _cellSuggestionsPanel = new Map<string, Panel>();
  private _model: ISuggestionsModel;
}

export namespace SuggestionsWidget {
  export interface IOptions extends PanelWithToolbar.IOptions {
    model: ISuggestionsModel;
  }
}
