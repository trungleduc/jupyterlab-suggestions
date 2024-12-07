import { IYText } from '@jupyter/ydoc';
import { Cell, CodeCell, ICodeCellModel } from '@jupyterlab/cells';
import {
  CodeMirrorEditorFactory,
  EditorExtensionRegistry,
  EditorLanguageRegistry,
  EditorThemeRegistry,
  ybinding
} from '@jupyterlab/codemirror';
import { ICell } from '@jupyterlab/nbformat';
import { ObservableMap } from '@jupyterlab/observables';
import {
  RenderMimeRegistry,
  standardRendererFactories as initialFactories
} from '@jupyterlab/rendermime';
import { JSONValue } from '@lumino/coreutils';
import { Signal } from '@lumino/signaling';
import { Panel } from '@lumino/widgets';

import { ISuggestionData } from '../../types';
import { diffTextExtensionFactory } from '../cmExtension';
import { suggestionCellStyle } from './style';
import { SuggestionToolbar } from './suggestionToolbar';

export class CellWidget extends Panel {
  constructor(options: CellWidget.IOptions) {
    super(options);
    const { suggestionData } = options;
    const { originalICell, cellModel } = suggestionData;
    this.addClass(suggestionCellStyle);
    this._cellId = cellModel.id as string | undefined;
    this._cellWidget = this._createCell(originalICell, cellModel);
    const toolbar = new SuggestionToolbar({
      toggleMinimized: this.toggleMinimized.bind(this),
      deleteCallback: options.deleteCallback,
      acceptCallback: options.acceptCallback,
      state: this._state
    });
    this.addWidget(toolbar);
    this.addWidget(this._cellWidget);
  }

  get cellId(): string | undefined {
    return this._cellId;
  }

  dispose(): void {
    Signal.clearData(this._cellWidget?.model);
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

  private _cmExtensioRegistry(originalSource: string): EditorExtensionRegistry {
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
          diffTextExtensionFactory({ originalSource })
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
  private _createCell(originalICell: ICell, cellModel: ICodeCellModel) {
    const rendermime = new RenderMimeRegistry({ initialFactories });

    const factoryService = new CodeMirrorEditorFactory({
      extensions: this._cmExtensioRegistry(originalICell.source as string),
      languages: this._cmLanguageRegistry()
    });

    const cellWidget = new CodeCell({
      contentFactory: new Cell.ContentFactory({
        editorFactory: factoryService.newInlineEditor.bind(factoryService)
      }),
      rendermime,
      model: cellModel,
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
    suggestionData: ISuggestionData;
    deleteCallback: () => Promise<void>;
    acceptCallback: () => Promise<void>;
  }
}
