import {
  ViewPlugin,
  Decoration,
  DecorationSet,
  ViewUpdate,
  WidgetType,
  EditorView
} from '@codemirror/view';
import * as Diff from 'diff';
class HighlightDiff {
  constructor(view: EditorView) {
    this._view = view;
    this.decorations = Decoration.none;
    this._originalText = this._view.state.doc.toString();
    this.updateDecorations();
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet) {
      this.updateDecorations();
    }
  }

  updateDecorations() {
    const currentText = this._view.state.doc.toString();
    // Compare words with spaces
    const diffs = Diff.diffWordsWithSpace(this._originalText, currentText);

    const decorations = [];
    let pos = 0;

    for (const diff of diffs) {
      const length = diff.value.length;

      if (diff.added) {
        // Highlight added text
        decorations.push(
          Decoration.mark({
            class: 'cm-diff-added'
          }).range(pos, pos + length)
        );
        pos += length; // Move the position for added text
      } else if (diff.removed) {
        // Keep removed text and display it inline as strikethrough
        decorations.push(
          Decoration.widget({
            widget: new RemovedTextWidget(diff.value),
            side: -1
          }).range(pos, pos) // Insert before current position
        );
      } else {
        pos += length; // Unchanged text
      }
    }

    this.decorations = Decoration.set(decorations);
  }

  destroy() {
    // TODO
  }

  decorations: DecorationSet;
  private _originalText: string;
  private _view: EditorView;
}
/**
 * Widget to show removed text
 *
 * @class RemovedTextWidget
 * @extends {WidgetType}
 */
class RemovedTextWidget extends WidgetType {
  constructor(text: string) {
    super();
    this._text = text;
  }

  get text(): string {
    return this._text;
  }

  toDOM() {
    const span = document.createElement('span');
    span.textContent = this._text;
    span.className = 'cm-diff-removed';
    return span;
  }

  eq(other: WidgetType) {
    return other instanceof RemovedTextWidget && other.text === this.text;
  }

  updateDOM() {
    return false;
  }

  private _text: string;
}

export const highlightTextExtension = [
  ViewPlugin.fromClass(HighlightDiff, {
    decorations: (v: HighlightDiff) => v.decorations
  })
];
