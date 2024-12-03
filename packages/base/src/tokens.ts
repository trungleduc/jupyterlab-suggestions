import { Token } from '@lumino/coreutils';
import {
  ISuggestionsManager,
  ISuggestionsModel,
  ISuggestionsManagerRegistry
} from './types';

export const ISuggestionsModelToken = new Token<ISuggestionsModel>(
  'jupyter-suggestions:suggestionsModel'
);

export const ISuggestionsManagerToken = new Token<ISuggestionsManager>(
  'jupyter-suggestions:suggestionsManager'
);

export const ISuggestionsManagerRegistryToken =
  new Token<ISuggestionsManagerRegistry>(
    'jupyter-suggestions:suggestionsManagerRegistry'
  );
