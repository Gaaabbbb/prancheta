import type { ComponentType } from 'react';
import type { PageId } from '@/store/uiStore';
import { Calendar } from './Calendar';
import { Clubs } from './Clubs';
import { Competitions } from './Competitions';
import { Editor } from './Editor';
import { Finance } from './Finance';
import { Fixtures } from './Fixtures';
import { Home } from './Home';
import { Market } from './Market';
import { Saves } from './Saves';
import { Squad } from './Squad';
import { Tactics } from './Tactics';
import { Youth } from './Youth';
import type { PageProps } from './types';

/** Registro de páginas do menu. Para criar uma página: componente aqui + item em layout/Nav.tsx. */
export const PAGES: Record<PageId, ComponentType<PageProps>> = {
  home: Home,
  squad: Squad,
  market: Market,
  youth: Youth,
  tactics: Tactics,
  calendar: Calendar,
  fixtures: Fixtures,
  tables: Competitions,
  clubs: Clubs,
  finance: Finance,
  editor: Editor,
  game: Saves,
};
