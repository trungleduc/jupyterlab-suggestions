import { IYText } from '@jupyter/ydoc';
import { Cell, CodeCell, CodeCellModel } from '@jupyterlab/cells';
import {
  CodeMirrorEditorFactory,
  EditorExtensionRegistry,
  EditorLanguageRegistry,
  EditorThemeRegistry,
  ybinding
} from '@jupyterlab/codemirror';
import { ICell } from '@jupyterlab/nbformat';
import {
  RenderMimeRegistry,
  standardRendererFactories as initialFactories
} from '@jupyterlab/rendermime';
import { Panel } from '@lumino/widgets';
import { ObservableMap } from '@jupyterlab/observables';
import { highlightTextExtension } from '../cmExtension';
import { suggestionCellStyle } from './style';
import { SuggestionToolbar } from './suggestionToolbar';
import { JSONValue } from '@lumino/coreutils';

export class CellWidget extends Panel {
  constructor(options: CellWidget.IOptions) {
    super(options);
    const { cellModel } = options;
    this.addClass(suggestionCellStyle);
    this._cellId = cellModel.id as string | undefined;
    this._cellWidget = this._createCell(cellModel);
    const toolbar = new SuggestionToolbar({
      toggleMinimized: this.toggleMinimized.bind(this),
      deleteCallback: options.deleteCallback,
      state: this._state
    });
    this.addWidget(toolbar);
    this.addWidget(this._cellWidget);
  }

  get cellId(): string | undefined {
    return this._cellId;
  }

  dispose(): void {
    this._cellWidget?.dispose();
    super.dispose();
  }
  toggleMinimized(min: boolean) {
    this._state.set('minimized', min);
    if (min) {
      this._cellWidget?.addClass('minimize');
    } else {
      this._cellWidget?.removeClass('minimize');
    }
  }

  private _cmExtensioRegistry(): EditorExtensionRegistry {
    const themes = new EditorThemeRegistry();
    EditorThemeRegistry.getDefaultThemes().forEach(theme => {
      themes.addTheme(theme);
    });
    const registry = new EditorExtensionRegistry();

    EditorExtensionRegistry.getDefaultExtensions({ themes }).forEach(
      extensionFactory => {
        registry.addExtension(extensionFactory);
      }
    );
    registry.addExtension({
      name: 'shared-model-binding',
      factory: options => {
        const sharedModel = options.model.sharedModel as IYText;
        return EditorExtensionRegistry.createImmutableExtension(
          ybinding({
            ytext: sharedModel.ysource
          })
        );
      }
    });
    registry.addExtension({
      name: 'suggestion-view',
      factory: options => {
        return EditorExtensionRegistry.createImmutableExtension([
          highlightTextExtension
        ]);
      }
    });
    return registry;
  }

  private _cmLanguageRegistry(): EditorLanguageRegistry {
    const languages = new EditorLanguageRegistry();
    EditorLanguageRegistry.getDefaultLanguages()
      .filter(language =>
        ['ipython', 'julia', 'python'].includes(language.name.toLowerCase())
      )
      .forEach(language => {
        languages.addLanguage(language);
      });

    languages.addLanguage({
      name: 'ipythongfm',
      mime: 'text/x-ipythongfm',
      load: async () => {
        const m = await import('@codemirror/lang-markdown');
        return m.markdown({
          codeLanguages: (info: string) => languages.findBest(info) as any
        });
      }
    });
    return languages;
  }
  private _createCell(cellModel: ICell) {
    const rendermime = new RenderMimeRegistry({ initialFactories });

    const factoryService = new CodeMirrorEditorFactory({
      extensions: this._cmExtensioRegistry(),
      languages: this._cmLanguageRegistry()
    });
    const model = new CodeCellModel();
    let mimeType = 'text/plain';
    if (cellModel.cell_type === 'code') {
      //TODO Detect correct kernel language
      mimeType = 'text/x-ipython';
    } else if (cellModel.cell_type === 'markdown') {
      mimeType = 'text/x-ipythongfm';
    }
    model.mimeType = mimeType;
    model.sharedModel.setSource(cellModel.source as string);
    const cellWidget = new CodeCell({
      contentFactory: new Cell.ContentFactory({
        editorFactory: factoryService.newInlineEditor.bind(factoryService)
      }),
      rendermime,
      model,
      editorConfig: {
        lineNumbers: false,
        lineWrap: false,
        matchBrackets: true,
        tabFocusable: false
      }
    }).initializeState();

    return cellWidget;
  }
  private _state: ObservableMap<JSONValue> = new ObservableMap({
    values: { minimized: false }
  });
  private _cellId: string | undefined;
  private _cellWidget: CodeCell | undefined;
}

export namespace CellWidget {
  export interface IOptions extends Panel.IOptions {
    cellModel: ICell;
    deleteCallback: () => Promise<void>;
  }
}
