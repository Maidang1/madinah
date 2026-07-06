import H1 from './H1.astro';
import H2 from './H2.astro';
import H3 from './H3.astro';
import H4 from './H4.astro';
import H5 from './H5.astro';
import H6 from './H6.astro';
import A from './A.astro';
import Table from './Table.astro';
import Callout from './Callout.astro';

// Pure HTML elements are styled by .post-content in global.css.
export const components = {
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H4,
  h5: H5,
  h6: H6,
  a: A,
  table: Table,
  Callout,
};
