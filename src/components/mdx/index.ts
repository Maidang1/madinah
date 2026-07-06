import A from './A.astro';
import Table from './Table.astro';
import Callout from './Callout.astro';

// Pure HTML elements are styled by .post-content in global.css.
export const components = {
  a: A,
  table: Table,
  Callout,
};
